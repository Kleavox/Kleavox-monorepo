import {
  notifyReport,
  readCookie,
  verifyChallenge,
  verifySession,
} from "@kleavox/auth";
import type { SessionIdentity } from "@kleavox/core";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";

import type { Env } from "../env";
import {
  actorHash,
  createDownloadGrant,
  hashPassword,
  randomToken,
  readBearerToken,
  sha256,
  verifyDownloadGrant,
  verifyPassword,
} from "./lib/crypto";
import {
  contentDisposition,
  normalizeContentType,
  sanitizeFileName,
} from "./lib/files";
import {
  expectedPartSize,
  GLOBAL_ACTIVE_STORAGE_BYTES,
  GUEST_POLICY,
  normalizeDownloadLimit,
  normalizeRetention,
  PART_SIZE_BYTES,
  policyFor,
  UPLOAD_TTL_SECONDS,
  USER_POLICY,
} from "./lib/limits";
import { createFileSlug } from "./lib/slug";
import {
  createUploadSchema,
  reportSchema,
  reportUpdateSchema,
  unlockSchema,
} from "./schemas";

interface Variables {
  session: SessionIdentity;
}

type DropContext = Context<{ Bindings: Env; Variables: Variables }>;

export interface UploadRow {
  id: string;
  owner_user_id: string | null;
  guest_actor_hash: string | null;
  manage_token_hash: string;
  public_token: string;
  public_token_hash: string;
  object_key: string;
  r2_upload_id: string | null;
  original_name: string;
  content_type: string;
  size_bytes: number;
  source_size_bytes: number | null;
  storage_encoding: string | null;
  part_size_bytes: number;
  part_count: number;
  password_hash: string | null;
  max_downloads: number | null;
  expires_at: string;
  upload_expires_at: string;
  status: string;
  created_at: string;
}

export interface DropRow {
  id: string;
  owner_user_id: string | null;
  guest_actor_hash: string | null;
  manage_token_hash: string | null;
  public_token: string | null;
  public_token_hash: string;
  object_key: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  source_size_bytes: number | null;
  storage_encoding: string | null;
  password_hash: string | null;
  max_downloads: number | null;
  download_count: number;
  expires_at: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface PartRow {
  part_number: number;
  etag: string;
  size_bytes: number;
}

const ACTIVE_DROP_STATUSES = "('ACTIVE', 'EXHAUSTED', 'DELETING')";
const ACTIVE_UPLOAD_STATUSES = "('OPENING', 'OPEN', 'COMPLETING')";
const UNLOCK_COOKIE = "kleavox_drop_grant";

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

export async function purgeDropUser(env: Env, userId: string): Promise<void> {
  for (let round = 0; round < 20; round += 1) {
    const uploads = await env.DB.prepare(
      `SELECT id, owner_user_id, guest_actor_hash, manage_token_hash,
              public_token, public_token_hash, object_key, r2_upload_id,
              original_name, content_type, size_bytes, source_size_bytes,
              storage_encoding, part_size_bytes, part_count, password_hash,
              max_downloads, expires_at, upload_expires_at, status, created_at
       FROM upload_sessions
       WHERE owner_user_id = ? AND status IN ('OPENING', 'OPEN', 'COMPLETING')
       LIMIT 50`,
    )
      .bind(userId)
      .all<UploadRow>();
    if (uploads.results.length === 0) break;
    for (const upload of uploads.results) {
      await abortUpload(env, upload);
    }
  }

  for (let round = 0; round < 20; round += 1) {
    const drops = await env.DB.prepare(
      `SELECT id, owner_user_id, guest_actor_hash, manage_token_hash,
              public_token, public_token_hash, object_key, original_name,
              content_type, size_bytes, password_hash, max_downloads,
              download_count, expires_at, status, created_at, completed_at
       FROM drops
       WHERE owner_user_id = ? AND status IN ('ACTIVE', 'EXHAUSTED', 'DELETING')
       LIMIT 50`,
    )
      .bind(userId)
      .all<DropRow>();
    if (drops.results.length === 0) break;
    for (const drop of drops.results) {
      await deleteDrop(env, drop, "account_deleted");
    }
  }

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM upload_sessions WHERE owner_user_id = ?`).bind(
      userId,
    ),
    env.DB.prepare(`DELETE FROM drops WHERE owner_user_id = ?`).bind(userId),
  ]);
}

app.get("/api/limits", (context) =>
  context.json({
    guest: publicPolicy(GUEST_POLICY),
    user: publicPolicy(USER_POLICY),
    global: { maxActiveStorageBytes: GLOBAL_ACTIVE_STORAGE_BYTES },
    upload: {
      partSizeBytes: PART_SIZE_BYTES,
      sessionTtlSeconds: UPLOAD_TTL_SECONDS,
    },
  }),
);

app.get("/api/drop/session", async (context) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json({
      authenticated: false,
      policy: publicPolicy(GUEST_POLICY),
    });
  }
  return context.json({
    authenticated: true,
    user: session.identity,
    policy: publicPolicy(USER_POLICY),
  });
});

app.post("/api/uploads", async (context) => {
  const body = createUploadSchema.safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  const session = await verifySession(context.req.raw, context.env.PASS);
  const identity = session?.identity ?? null;
  const policy = policyFor(identity);
  if (body.data.sizeBytes > policy.maxFileBytes) {
    return context.json(
      {
        code: "FILE_TOO_LARGE",
        message: `This file exceeds the ${policy.kind} upload limit.`,
      },
      413,
    );
  }

  const guestSecret = runtimeSecret(
    context.env,
    context.env.GUEST_HASH_SECRET,
    "drop-development-guest-secret",
  );
  if (!identity && !guestSecret) return configurationError(context);
  if (
    !identity &&
    !(await verifyChallenge(context.req.raw, context.env.PASS, "basic"))
  ) {
    return context.json(
      { code: "CHALLENGE_FAILED", message: "Security challenge failed." },
      403,
    );
  }

  const guestActorHash = identity
    ? null
    : await actorHash(guestSecret!, context.req.raw);
  const rateKey = identity?.id ?? guestActorHash!;
  if (!(await context.env.CREATE_RATE_LIMIT.limit({ key: rateKey })).success) {
    return context.json(
      { code: "RATE_LIMITED", message: "Too many upload attempts." },
      429,
    );
  }

  const retentionSeconds = normalizeRetention(
    body.data.retentionSeconds,
    policy,
  );
  const maxDownloads = normalizeDownloadLimit(body.data.maxDownloads, policy);
  const uploadId = crypto.randomUUID();
  const publicToken = createFileSlug();
  const manageToken = randomToken(32);
  const publicTokenHash = await sha256(publicToken);
  const manageTokenHash = await sha256(manageToken);
  const originalName = sanitizeFileName(body.data.name);
  const contentType = normalizeContentType(body.data.contentType);
  const storedSizeBytes = body.data.storedSizeBytes ?? body.data.sizeBytes;
  const storageEncoding = body.data.storageEncoding ?? null;
  const partCount = Math.ceil(storedSizeBytes / PART_SIZE_BYTES);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + retentionSeconds * 1000,
  ).toISOString();
  const uploadExpiresAt = new Date(
    Date.now() + UPLOAD_TTL_SECONDS * 1000,
  ).toISOString();
  const objectKey = `objects/${createdAt.slice(0, 7)}/${uploadId}`;
  const passwordSecret = runtimeSecret(
    context.env,
    context.env.PASSWORD_HASH_SECRET,
    "drop-development-password-secret",
  );
  if (body.data.password && !passwordSecret) return configurationError(context);
  const passwordHash =
    body.data.password && passwordSecret
      ? await hashPassword(body.data.password, passwordSecret)
      : null;

  const reservation = await context.env.DB.prepare(
    `INSERT INTO upload_sessions (
       id, owner_user_id, guest_actor_hash, manage_token_hash, public_token,
       public_token_hash, object_key, original_name, content_type, size_bytes,
       source_size_bytes, storage_encoding, part_size_bytes, part_count,
       password_hash, max_downloads, expires_at, upload_expires_at, status,
       created_at, updated_at
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
            'OPENING', ?, ?
     WHERE ? <= ?
       AND (
         COALESCE((
           SELECT SUM(size_bytes) FROM drops
           WHERE status IN ${ACTIVE_DROP_STATUSES}
             AND datetime(expires_at) > datetime('now')
         ), 0)
         + COALESCE((
           SELECT SUM(size_bytes) FROM upload_sessions
           WHERE status IN ${ACTIVE_UPLOAD_STATUSES}
             AND datetime(upload_expires_at) > datetime('now')
         ), 0)
         + ?
       ) <= ?
       AND (
         (
           ? IS NOT NULL
           AND COALESCE((
             SELECT SUM(size_bytes) FROM drops
             WHERE owner_user_id = ?
               AND status IN ${ACTIVE_DROP_STATUSES}
               AND datetime(expires_at) > datetime('now')
           ), 0)
           + COALESCE((
             SELECT SUM(size_bytes) FROM upload_sessions
             WHERE owner_user_id = ?
               AND status IN ${ACTIVE_UPLOAD_STATUSES}
               AND datetime(upload_expires_at) > datetime('now')
           ), 0)
           + ? <= ?
         )
         OR
         (
           ? IS NULL
           AND COALESCE((
             SELECT SUM(size_bytes) FROM drops
             WHERE guest_actor_hash = ?
               AND status IN ${ACTIVE_DROP_STATUSES}
               AND datetime(expires_at) > datetime('now')
           ), 0)
           + COALESCE((
             SELECT SUM(size_bytes) FROM upload_sessions
             WHERE guest_actor_hash = ?
               AND status IN ${ACTIVE_UPLOAD_STATUSES}
               AND datetime(upload_expires_at) > datetime('now')
           ), 0)
           + ? <= ?
         )
       )`,
  )
    .bind(
      uploadId,
      identity?.id ?? null,
      guestActorHash,
      manageTokenHash,
      publicToken,
      publicTokenHash,
      objectKey,
      originalName,
      contentType,
      storedSizeBytes,
      body.data.sizeBytes,
      storageEncoding,
      PART_SIZE_BYTES,
      partCount,
      passwordHash,
      maxDownloads,
      expiresAt,
      uploadExpiresAt,
      createdAt,
      createdAt,
      body.data.sizeBytes,
      policy.maxFileBytes,
      storedSizeBytes,
      GLOBAL_ACTIVE_STORAGE_BYTES,
      identity?.id ?? null,
      identity?.id ?? null,
      identity?.id ?? null,
      storedSizeBytes,
      policy.maxActiveBytes,
      identity?.id ?? null,
      guestActorHash,
      guestActorHash,
      storedSizeBytes,
      policy.maxActiveBytes,
    )
    .run();

  if ((reservation.meta.changes ?? 0) !== 1) {
    return context.json(
      {
        code: "QUOTA_EXCEEDED",
        message: "Active storage quota is currently full.",
      },
      507,
    );
  }

  try {
    const multipart = await context.env.FILES.createMultipartUpload(objectKey, {
      httpMetadata: {
        contentType,
        contentDisposition: contentDisposition(originalName),
        contentEncoding: storageEncoding ?? undefined,
      },
      customMetadata: {
        dropId: uploadId,
        sourceSizeBytes: String(body.data.sizeBytes),
      },
    });
    await context.env.DB.prepare(
      `UPDATE upload_sessions
       SET r2_upload_id = ?, status = 'OPEN', updated_at = datetime('now')
       WHERE id = ? AND status = 'OPENING'`,
    )
      .bind(multipart.uploadId, uploadId)
      .run();
  } catch (error) {
    await context.env.DB.prepare(
      `UPDATE upload_sessions
       SET status = 'FAILED', updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(uploadId)
      .run();
    console.error("Unable to create R2 multipart upload", error);
    return context.json(
      { code: "STORAGE_UNAVAILABLE", message: "Upload could not be started." },
      503,
    );
  }

  return context.json(
    {
      uploadId,
      manageToken,
      publicToken,
      shareUrl: `${context.env.PUBLIC_SHORT_ORIGIN}/${publicToken}`,
      partSizeBytes: PART_SIZE_BYTES,
      partCount,
      expiresAt,
      maxDownloads,
    },
    201,
  );
});

app.put("/api/uploads/:id/parts/:partNumber", async (context) => {
  const upload = await findUpload(context.env.DB, context.req.param("id"));
  if (!upload || !(await canManageUpload(context.req.raw, upload))) {
    return context.json(
      { code: "NOT_FOUND", message: "Upload session not found." },
      404,
    );
  }
  if (
    upload.status !== "OPEN" ||
    Date.parse(upload.upload_expires_at) <= Date.now() ||
    !upload.r2_upload_id
  ) {
    return context.json(
      { code: "UPLOAD_CLOSED", message: "Upload session is closed." },
      410,
    );
  }

  const partNumber = Number(context.req.param("partNumber"));
  const expectedBytes = expectedPartSize(
    upload.size_bytes,
    partNumber,
    upload.part_count,
  );
  const contentLength = Number(context.req.header("content-length"));
  if (
    !expectedBytes ||
    !Number.isSafeInteger(contentLength) ||
    contentLength !== expectedBytes ||
    !context.req.raw.body
  ) {
    return context.json(
      { code: "INVALID_PART", message: "Part size or number is invalid." },
      400,
    );
  }

  try {
    const multipart = context.env.FILES.resumeMultipartUpload(
      upload.object_key,
      upload.r2_upload_id,
    );
    const part = await multipart.uploadPart(partNumber, context.req.raw.body);
    await context.env.DB.prepare(
      `INSERT INTO upload_parts (upload_id, part_number, etag, size_bytes)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(upload_id, part_number) DO UPDATE SET
         etag = excluded.etag,
         size_bytes = excluded.size_bytes,
         created_at = datetime('now')`,
    )
      .bind(upload.id, partNumber, part.etag, contentLength)
      .run();
    return context.json({ partNumber, etag: part.etag });
  } catch (error) {
    console.error("Unable to upload R2 part", error);
    return context.json(
      { code: "PART_FAILED", message: "This part could not be stored." },
      502,
    );
  }
});

app.post("/api/uploads/:id/complete", async (context) => {
  const upload = await findUpload(context.env.DB, context.req.param("id"));
  if (!upload || !(await canManageUpload(context.req.raw, upload))) {
    return context.json(
      { code: "NOT_FOUND", message: "Upload session not found." },
      404,
    );
  }
  if (
    !["OPEN", "COMPLETING"].includes(upload.status) ||
    Date.parse(upload.upload_expires_at) <= Date.now() ||
    !upload.r2_upload_id
  ) {
    return context.json(
      { code: "UPLOAD_CLOSED", message: "Upload session is closed." },
      410,
    );
  }

  const partsResult = await context.env.DB.prepare(
    `SELECT part_number, etag, size_bytes
     FROM upload_parts WHERE upload_id = ? ORDER BY part_number`,
  )
    .bind(upload.id)
    .all<PartRow>();
  const parts = partsResult.results;
  const validParts =
    parts.length === upload.part_count &&
    parts.every(
      (part, index) =>
        part.part_number === index + 1 &&
        part.size_bytes ===
          expectedPartSize(
            upload.size_bytes,
            part.part_number,
            upload.part_count,
          ),
    );
  if (!validParts) {
    return context.json(
      { code: "UPLOAD_INCOMPLETE", message: "Not every part has arrived." },
      409,
    );
  }

  if (upload.status === "OPEN") {
    const claimed = await context.env.DB.prepare(
      `UPDATE upload_sessions
       SET status = 'COMPLETING', updated_at = datetime('now')
       WHERE id = ? AND status = 'OPEN'`,
    )
      .bind(upload.id)
      .run();
    if ((claimed.meta.changes ?? 0) !== 1) {
      return context.json(
        { code: "UPLOAD_BUSY", message: "Upload is already completing." },
        409,
      );
    }

    try {
      const multipart = context.env.FILES.resumeMultipartUpload(
        upload.object_key,
        upload.r2_upload_id,
      );
      await multipart.complete(
        parts.map((part) => ({
          partNumber: part.part_number,
          etag: part.etag,
        })),
      );
    } catch (error) {
      const object = await context.env.FILES.head(upload.object_key);
      if (!object) {
        await context.env.DB.prepare(
          `UPDATE upload_sessions
           SET status = 'OPEN', updated_at = datetime('now')
           WHERE id = ? AND status = 'COMPLETING'`,
        )
          .bind(upload.id)
          .run();
        console.error("Unable to complete R2 multipart upload", error);
        return context.json(
          {
            code: "COMPLETE_FAILED",
            message: "Upload could not be completed.",
          },
          502,
        );
      }
    }
  } else if (!(await context.env.FILES.head(upload.object_key))) {
    return context.json(
      { code: "COMPLETE_PENDING", message: "Upload completion is pending." },
      409,
    );
  }

  await finalizeUploadRecord(context.env, upload.id);
  return context.json({
    dropId: upload.id,
    publicToken: upload.public_token,
    shareUrl: `${context.env.PUBLIC_SHORT_ORIGIN}/${upload.public_token}`,
    expiresAt: upload.expires_at,
  });
});

app.delete("/api/uploads/:id", async (context) => {
  const upload = await findUpload(context.env.DB, context.req.param("id"));
  if (!upload || !(await canManageUpload(context.req.raw, upload))) {
    return context.body(null, 404);
  }
  await abortUpload(context.env, upload);
  return context.body(null, 204);
});

const requireSession: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (context, next) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json(
      { code: "UNAUTHORIZED", message: "Sign in with Kleavox Pass." },
      401,
    );
  }
  context.set("session", session);
  await next();
};

app.get("/api/drops", requireSession, async (context) => {
  const ownerId = context.get("session").identity.id;
  const drops = await context.env.DB.prepare(
    `SELECT id, public_token, original_name, content_type, size_bytes,
            COALESCE(source_size_bytes, size_bytes) AS source_size_bytes,
            storage_encoding, max_downloads, download_count, expires_at,
            status, created_at, completed_at,
            password_hash IS NOT NULL AS protected
     FROM drops WHERE owner_user_id = ?
       AND public_token IS NOT NULL
     ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(ownerId)
    .all();
  return context.json({ drops: drops.results });
});

app.get("/api/public/:token", async (context) => {
  const drop = await findPublicDrop(context.env.DB, context.req.param("token"));
  if (!drop) {
    return context.json(
      { code: "NOT_FOUND", message: "This drop does not exist." },
      404,
    );
  }
  if (Date.parse(drop.expires_at) <= Date.now() || drop.status !== "ACTIVE") {
    return context.json(
      { code: "DROP_ENDED", message: "This drop is no longer available." },
      410,
    );
  }
  return context.json(publicDrop(drop));
});

app.post("/api/public/:token/unlock", async (context) => {
  const body = unlockSchema.safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  const drop = await findPublicDrop(context.env.DB, context.req.param("token"));
  if (!drop || drop.status !== "ACTIVE") return context.body(null, 404);
  if (!drop.password_hash) {
    return context.json({ unlocked: true, protected: false });
  }

  const rateKey = await sha256(context.req.param("token"));
  if (
    !(
      await context.env.DOWNLOAD_RATE_LIMIT.limit({
        key: `unlock:${rateKey}`,
      })
    ).success
  ) {
    return context.json(
      { code: "RATE_LIMITED", message: "Too many password attempts." },
      429,
    );
  }
  const passwordSecret = runtimeSecret(
    context.env,
    context.env.PASSWORD_HASH_SECRET,
    "drop-development-password-secret",
  );
  if (!passwordSecret) return configurationError(context);
  if (
    !(await verifyPassword(
      body.data.password,
      drop.password_hash,
      passwordSecret,
    ))
  ) {
    return context.json(
      { code: "INVALID_PASSWORD", message: "Password is incorrect." },
      401,
    );
  }

  const secret = runtimeSecret(
    context.env,
    context.env.DOWNLOAD_SIGNING_SECRET,
    "drop-development-download-secret",
  );
  if (!secret) return configurationError(context);
  const grant = await createDownloadGrant(drop.id, secret);
  const secure = context.env.ENVIRONMENT === "production" ? "; Secure" : "";
  context.header(
    "Set-Cookie",
    `${UNLOCK_COOKIE}=${encodeURIComponent(grant)}; Path=/api/public/${context.req.param("token")}/download; Max-Age=300; HttpOnly; SameSite=Strict${secure}`,
  );
  return context.json({ unlocked: true, protected: true });
});

app.get("/api/public/:token/download", async (context) => {
  const token = context.req.param("token");
  const tokenHash = await sha256(token);
  if (
    !(
      await context.env.DOWNLOAD_RATE_LIMIT.limit({
        key: `download:${tokenHash}`,
      })
    ).success
  ) {
    return context.json(
      { code: "RATE_LIMITED", message: "Too many download attempts." },
      429,
    );
  }

  const drop = await findPublicDrop(context.env.DB, token);
  if (
    !drop ||
    drop.status !== "ACTIVE" ||
    Date.parse(drop.expires_at) <= Date.now()
  ) {
    return context.json(
      { code: "DROP_ENDED", message: "This drop is no longer available." },
      410,
    );
  }
  if (drop.password_hash) {
    const secret = runtimeSecret(
      context.env,
      context.env.DOWNLOAD_SIGNING_SECRET,
      "drop-development-download-secret",
    );
    const grant = readCookie(context.req.raw, UNLOCK_COOKIE);
    if (
      !secret ||
      !grant ||
      !(await verifyDownloadGrant(grant, drop.id, secret))
    ) {
      return context.json(
        { code: "LOCKED", message: "Unlock this drop before downloading." },
        401,
      );
    }
  }

  const object = await context.env.FILES.get(drop.object_key);
  if (!object) {
    context.executionCtx.waitUntil(
      markDropFailed(context.env.DB, drop.id, "OBJECT_MISSING"),
    );
    return context.json(
      { code: "OBJECT_MISSING", message: "The stored file is unavailable." },
      410,
    );
  }

  const claimed = await context.env.DB.prepare(
    `UPDATE drops
     SET download_count = download_count + 1,
         status = CASE
           WHEN max_downloads IS NOT NULL
             AND download_count + 1 >= max_downloads
           THEN 'EXHAUSTED'
           ELSE status
         END
     WHERE id = ?
       AND status = 'ACTIVE'
       AND datetime(expires_at) > datetime('now')
       AND (max_downloads IS NULL OR download_count < max_downloads)`,
  )
    .bind(drop.id)
    .run();
  if ((claimed.meta.changes ?? 0) !== 1) {
    await object.body.cancel();
    return context.json(
      { code: "DOWNLOAD_LIMIT", message: "The download limit was reached." },
      410,
    );
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Disposition", contentDisposition(drop.original_name));
  headers.set("Content-Type", drop.content_type);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  let body = object.body;
  if (drop.storage_encoding === "gzip") {
    body = body.pipeThrough(new DecompressionStream("gzip"));
    headers.set(
      "Content-Length",
      (drop.source_size_bytes ?? object.size).toString(),
    );
  } else {
    headers.set("Content-Length", object.size.toString());
  }

  return new Response(body, { headers });
});

app.delete("/api/public/:token", async (context) => {
  const drop = await findPublicDrop(context.env.DB, context.req.param("token"));
  if (!drop) return context.body(null, 404);

  const session = await verifySession(context.req.raw, context.env.PASS);
  const bearer = readBearerToken(context.req.raw);
  const bearerHash = bearer ? await sha256(bearer) : null;
  const allowed =
    session?.identity.role === "ADMIN" ||
    (session && session.identity.id === drop.owner_user_id) ||
    (bearerHash && bearerHash === drop.manage_token_hash);
  if (!allowed) return context.body(null, 404);

  await deleteDrop(context.env, drop, "OWNER_REQUEST");
  return context.body(null, 204);
});

app.post("/api/public/:token/reports", async (context) => {
  const body = reportSchema.safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);

  const tokenHash = await sha256(context.req.param("token"));
  if (
    !(
      await context.env.FILE_REPORT_RATE_LIMIT.limit({
        key: `report:${tokenHash}`,
      })
    ).success
  ) {
    return context.json(
      { code: "RATE_LIMITED", message: "Too many reports." },
      429,
    );
  }
  const drop = await findPublicDrop(context.env.DB, context.req.param("token"));
  if (!drop) return context.body(null, 404);
  const session = await verifySession(context.req.raw, context.env.PASS);

  await context.env.DB.prepare(
    `INSERT INTO abuse_reports (
       id, drop_id, reporter_user_id, reason, details, updated_at
     ) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  )
    .bind(
      crypto.randomUUID(),
      drop.id,
      session?.identity.id ?? null,
      body.data.reason,
      body.data.details ?? null,
    )
    .run();
  context.executionCtx.waitUntil(
    notifyReport(context.env.PULSE, {
      kind: "file",
      reason: body.data.reason,
      target: drop.original_name ?? context.req.param("token"),
    }),
  );
  return context.json({ reported: true }, 201);
});

app.get("/api/admin/file-reports", requireSession, async (context) => {
  if (context.get("session").identity.role !== "ADMIN") {
    return context.body(null, 403);
  }
  const reports = await context.env.DB.prepare(
    `SELECT r.id, r.drop_id, r.reason, r.details, r.status, r.created_at,
            r.updated_at, d.original_name, d.public_token, d.status AS drop_status
     FROM abuse_reports r
     LEFT JOIN drops d ON d.id = r.drop_id
     ORDER BY CASE r.status WHEN 'OPEN' THEN 0 ELSE 1 END, r.created_at DESC
     LIMIT 200`,
  ).all();
  return context.json({ reports: reports.results });
});

app.patch("/api/admin/file-reports/:id", requireSession, async (context) => {
  if (context.get("session").identity.role !== "ADMIN") {
    return context.body(null, 403);
  }
  const body = reportUpdateSchema.safeParse(await readJson(context));
  if (!body.success) return invalidRequest(context);
  const updated = await context.env.DB.prepare(
    `UPDATE abuse_reports
     SET status = ?, updated_at = datetime('now'),
         resolved_at = CASE WHEN ? = 'OPEN' THEN NULL ELSE datetime('now') END
     WHERE id = ?`,
  )
    .bind(body.data.status, body.data.status, context.req.param("id"))
    .run();
  if ((updated.meta.changes ?? 0) !== 1) return context.body(null, 404);
  return context.json({ updated: true });
});

export async function finalizeUploadRecord(
  env: Env,
  uploadId: string,
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO drops (
         id, owner_user_id, guest_actor_hash, public_token, public_token_hash,
         manage_token_hash, object_key, original_name, content_type, size_bytes,
         source_size_bytes, storage_encoding, password_hash, max_downloads,
         expires_at, status, created_at, completed_at
       )
       SELECT id, owner_user_id, guest_actor_hash, public_token,
              public_token_hash, manage_token_hash, object_key, original_name,
              content_type, size_bytes, source_size_bytes, storage_encoding,
              password_hash, max_downloads, expires_at, 'ACTIVE', created_at,
              datetime('now')
       FROM upload_sessions
       WHERE id = ? AND status = 'COMPLETING'`,
    ).bind(uploadId),
    env.DB.prepare(
      `UPDATE upload_sessions
       SET status = 'COMPLETED', updated_at = datetime('now')
       WHERE id = ? AND status = 'COMPLETING'`,
    ).bind(uploadId),
  ]);
}

export async function abortUpload(env: Env, upload: UploadRow): Promise<void> {
  const claimed = await env.DB.prepare(
    `UPDATE upload_sessions
     SET status = 'ABORTING', updated_at = datetime('now')
     WHERE id = ? AND status IN ('OPENING', 'OPEN', 'COMPLETING')`,
  )
    .bind(upload.id)
    .run();
  if ((claimed.meta.changes ?? 0) !== 1) return;

  if (upload.r2_upload_id) {
    try {
      await env.FILES.resumeMultipartUpload(
        upload.object_key,
        upload.r2_upload_id,
      ).abort();
    } catch (error) {
      console.error("Unable to abort multipart upload", error);
    }
  }
  await env.DB.prepare(
    `UPDATE upload_sessions
     SET status = 'ABORTED', updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(upload.id)
    .run();
}

export async function deleteDrop(
  env: Env,
  drop: DropRow,
  reason: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE drops SET status = 'DELETING', delete_reason = ?
     WHERE id = ? AND status IN ('ACTIVE', 'EXHAUSTED', 'DELETING')`,
  )
    .bind(reason, drop.id)
    .run();
  try {
    await env.FILES.delete(drop.object_key);
    await env.DB.prepare(
      `UPDATE drops
       SET status = 'DELETED', deleted_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(drop.id)
      .run();
  } catch (error) {
    console.error("Unable to delete R2 object", error);
    throw error;
  }
}

async function findUpload(
  database: D1Database,
  id: string,
): Promise<UploadRow | null> {
  return database
    .prepare(
      `SELECT id, owner_user_id, guest_actor_hash, manage_token_hash,
              public_token, public_token_hash, object_key, r2_upload_id,
              original_name, content_type, size_bytes, source_size_bytes,
              storage_encoding, part_size_bytes, part_count, password_hash,
              max_downloads, expires_at, upload_expires_at, status, created_at
       FROM upload_sessions WHERE id = ?`,
    )
    .bind(id)
    .first<UploadRow>();
}

async function canManageUpload(
  request: Request,
  upload: UploadRow,
): Promise<boolean> {
  const token = readBearerToken(request);
  return Boolean(token && (await sha256(token)) === upload.manage_token_hash);
}

async function findPublicDrop(
  database: D1Database,
  token: string,
): Promise<DropRow | null> {
  return database
    .prepare(
      `SELECT id, owner_user_id, guest_actor_hash, manage_token_hash,
              public_token, public_token_hash, object_key, original_name,
              content_type, size_bytes, source_size_bytes, storage_encoding,
              password_hash, max_downloads, download_count, expires_at,
              status, created_at, completed_at
       FROM drops WHERE public_token_hash = ?`,
    )
    .bind(await sha256(token))
    .first<DropRow>();
}

function publicDrop(drop: DropRow) {
  return {
    name: drop.original_name,
    contentType: drop.content_type,
    sizeBytes: drop.source_size_bytes ?? drop.size_bytes,
    storedSizeBytes: drop.size_bytes,
    storageEncoding: drop.storage_encoding,
    compressed: drop.storage_encoding === "gzip",
    protected: Boolean(drop.password_hash),
    maxDownloads: drop.max_downloads,
    downloadCount: drop.download_count,
    remainingDownloads:
      drop.max_downloads === null
        ? null
        : Math.max(drop.max_downloads - drop.download_count, 0),
    expiresAt: drop.expires_at,
    createdAt: drop.created_at,
  };
}

function publicPolicy(policy: typeof GUEST_POLICY) {
  return {
    kind: policy.kind,
    maxFileBytes: policy.maxFileBytes,
    maxActiveBytes: policy.maxActiveBytes,
    retentionOptions: policy.retentionOptions,
    maxDownloads: policy.maxDownloads,
    defaultDownloads: policy.defaultDownloads,
  };
}

function runtimeSecret(
  env: Env,
  configured: string | undefined,
  developmentFallback: string,
): string | null {
  return (
    configured ??
    (env.ENVIRONMENT === "production" ? null : developmentFallback)
  );
}

function configurationError(context: DropContext) {
  return context.json(
    {
      code: "CONFIGURATION_ERROR",
      message: "Required production security configuration is missing.",
    },
    503,
  );
}

function invalidRequest(context: DropContext) {
  return context.json(
    { code: "INVALID_REQUEST", message: "Request data is invalid." },
    400,
  );
}

async function readJson(context: DropContext): Promise<unknown> {
  return context.req.json().catch(() => null);
}

function markDropFailed(
  database: D1Database,
  id: string,
  reason: string,
): Promise<D1Result> {
  return database
    .prepare(
      `UPDATE drops SET status = 'FAILED', delete_reason = ? WHERE id = ?`,
    )
    .bind(reason, id)
    .run();
}
