import {
  notifyReport,
  readCookie,
  verifyChallenge,
  verifySession,
} from "@kleavox/auth";
import { INTERNAL_HOSTS } from "@kleavox/config";
import type { SessionIdentity } from "@kleavox/core";
import {
  accountDropsResponseSchema,
  dropSessionResponseSchema,
  publicDropSchema,
} from "@kleavox/link-protocol";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";

import type { Env } from "../env";
import {
  actorHash,
  createDownloadGrant,
  hashPassword,
  randomToken,
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
import { createDropLifecycle, manageToken } from "./lifecycle";
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

interface DropRow {
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
  encryption: string | null;
  password_hash: string | null;
  max_downloads: number | null;
  download_count: number;
  expires_at: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface AccountDropRow {
  id: string;
  public_token: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  source_size_bytes: number;
  storage_encoding: "gzip" | null;
  encryption: "aes-256-gcm" | null;
  max_downloads: number | null;
  download_count: number;
  expires_at: string;
  status: "ACTIVE" | "EXHAUSTED" | "DELETING" | "DELETED" | "FAILED";
  created_at: string;
  completed_at: string | null;
  protected: number;
  shared: number;
}

const ACTIVE_DROP_STATUSES = "('ACTIVE', 'EXHAUSTED', 'DELETING')";
const ACTIVE_UPLOAD_STATUSES = "('OPENING', 'OPEN', 'COMPLETING')";
const UNLOCK_COOKIE = "kleavox_drop_grant";

export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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
    return context.json(
      dropSessionResponseSchema.parse({
        authenticated: false,
        policy: publicPolicy(GUEST_POLICY),
      }),
    );
  }
  return context.json(
    dropSessionResponseSchema.parse({
      authenticated: true,
      user: session.identity,
      policy: publicPolicy(USER_POLICY),
    }),
  );
});

app.get("/api/drop/recipient-key", async (context) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json(
      { code: "UNAUTHORIZED", message: "Sign in to share." },
      401,
    );
  }
  const username = context.req.query("username");
  if (!username) {
    return context.json(
      { code: "INVALID_INPUT", message: "Missing username." },
      400,
    );
  }
  const response = await context.env.PASS.fetch(
    `http://${INTERNAL_HOSTS.PASS}/internal/public-key?username=${encodeURIComponent(username)}`,
  );
  if (!response.ok) return context.json({ userId: null, publicKey: null });
  return context.json(
    await response.json<{ userId: string | null; publicKey: string | null }>(),
  );
});

app.get("/api/drop/account-key", async (context) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json(
      { code: "UNAUTHORIZED", message: "Sign in to open this transfer." },
      401,
    );
  }
  const response = await context.env.PASS.fetch(
    `http://${INTERNAL_HOSTS.PASS}/internal/account-key?userId=${encodeURIComponent(session.identity.id)}`,
  );
  if (!response.ok) {
    return context.json({ salt: null, wrappedPrivateKey: null });
  }
  return context.json(
    await response.json<{
      salt: string | null;
      wrappedPrivateKey: string | null;
    }>(),
  );
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
  if (!identity && body.data.storageEncoding === "aes-256-gcm") {
    return context.json(
      {
        code: "ENCRYPTION_NOT_ALLOWED",
        message: "Sign in to send end-to-end encrypted transfers.",
      },
      403,
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
  const storageEncoding = body.data.storageEncoding === "gzip" ? "gzip" : null;
  const encryption =
    body.data.storageEncoding === "aes-256-gcm" ? "aes-256-gcm" : null;
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
       source_size_bytes, storage_encoding, encryption, part_size_bytes,
       part_count, password_hash, max_downloads, expires_at, upload_expires_at,
       status, created_at, updated_at
     )
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
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
      encryption,
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

  if (body.data.recipients?.length) {
    await context.env.DB.batch(
      body.data.recipients.map((recipient) =>
        context.env.DB.prepare(
          `INSERT INTO drop_recipients (drop_id, recipient_user_id, sealed_key)
           VALUES (?, ?, ?)
           ON CONFLICT(drop_id, recipient_user_id)
             DO UPDATE SET sealed_key = excluded.sealed_key`,
        ).bind(uploadId, recipient.userId, recipient.sealedKey),
      ),
    );
  }

  try {
    const multipart = await context.env.FILES.createMultipartUpload(objectKey, {
      httpMetadata: {
        contentType,
        contentDisposition: contentDisposition(originalName),
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
  const result = await createDropLifecycle(context.env).storeUploadPart({
    uploadId: context.req.param("id"),
    manageToken: manageToken(context.req.raw),
    partNumber: Number(context.req.param("partNumber")),
    contentLength: Number(context.req.header("content-length")),
    body: context.req.raw.body,
  });
  if (result.status === "stored") {
    return context.json({
      partNumber: result.partNumber,
      etag: result.etag,
    });
  }
  if (result.status === "not_found") {
    return context.json(
      { code: "NOT_FOUND", message: "Upload session not found." },
      404,
    );
  }
  if (result.status === "closed") {
    return context.json(
      { code: "UPLOAD_CLOSED", message: "Upload session is closed." },
      410,
    );
  }
  if (result.status === "invalid") {
    return context.json(
      { code: "INVALID_PART", message: "Part size or number is invalid." },
      400,
    );
  }
  return context.json(
    { code: "PART_FAILED", message: "This part could not be stored." },
    502,
  );
});

app.post("/api/uploads/:id/complete", async (context) => {
  const result = await createDropLifecycle(context.env).completeUpload(
    context.req.param("id"),
    manageToken(context.req.raw),
  );
  if (result.status === "not_found") {
    return context.json(
      { code: "NOT_FOUND", message: "Upload session not found." },
      404,
    );
  }
  if (result.status === "closed") {
    return context.json(
      { code: "UPLOAD_CLOSED", message: "Upload session is closed." },
      410,
    );
  }
  if (result.status === "incomplete") {
    return context.json(
      { code: "UPLOAD_INCOMPLETE", message: "Not every part has arrived." },
      409,
    );
  }
  if (result.status === "busy") {
    return context.json(
      { code: "UPLOAD_BUSY", message: "Upload is already completing." },
      409,
    );
  }
  if (result.status === "pending") {
    return context.json(
      { code: "COMPLETE_PENDING", message: "Upload completion is pending." },
      409,
    );
  }
  if (result.status === "failed") {
    return context.json(
      { code: "COMPLETE_FAILED", message: "Upload could not be completed." },
      502,
    );
  }
  return context.json({
    dropId: result.dropId,
    publicToken: result.publicToken,
    shareUrl: `${context.env.PUBLIC_SHORT_ORIGIN}/${result.publicToken}`,
    expiresAt: result.expiresAt,
  });
});

app.delete("/api/uploads/:id", async (context) => {
  const deleted = await createDropLifecycle(context.env).abortUpload(
    context.req.param("id"),
    manageToken(context.req.raw),
  );
  if (!deleted) {
    return context.body(null, 404);
  }
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
            storage_encoding, encryption, max_downloads, download_count,
            expires_at, status, created_at, completed_at,
            password_hash IS NOT NULL AS protected,
            EXISTS(
              SELECT 1 FROM drop_recipients dr WHERE dr.drop_id = drops.id
            ) AS shared
     FROM drops WHERE owner_user_id = ?
       AND public_token IS NOT NULL
     ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(ownerId)
    .all<AccountDropRow>();
  return context.json(
    accountDropsResponseSchema.parse({
      drops: drops.results.map(accountDrop),
    }),
  );
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
  const shared =
    (await context.env.DB.prepare(
      `SELECT 1 FROM drop_recipients WHERE drop_id = ? LIMIT 1`,
    )
      .bind(drop.id)
      .first()) !== null;
  return context.json(publicDrop(drop, shared));
});

app.get("/api/public/:token/sealed-key", async (context) => {
  const session = await verifySession(context.req.raw, context.env.PASS);
  if (!session) {
    return context.json(
      { code: "UNAUTHORIZED", message: "Sign in to open this transfer." },
      401,
    );
  }
  const drop = await findPublicDrop(context.env.DB, context.req.param("token"));
  if (!drop || drop.status !== "ACTIVE") return context.body(null, 404);
  const row = await context.env.DB.prepare(
    `SELECT sealed_key FROM drop_recipients
     WHERE drop_id = ? AND recipient_user_id = ?`,
  )
    .bind(drop.id, session.identity.id)
    .first<{ sealed_key: string }>();
  if (!row) {
    return context.json(
      { code: "NOT_FOUND", message: "This transfer was not shared with you." },
      404,
    );
  }
  return context.json({ sealedKey: row.sealed_key });
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
  headers.delete("Content-Encoding");
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
  const session = await verifySession(context.req.raw, context.env.PASS);
  const deleted = await createDropLifecycle(context.env).deletePublicDrop(
    context.req.param("token"),
    {
      userId: session?.identity.id ?? null,
      isAdmin: session?.identity.role === "ADMIN",
      manageToken: manageToken(context.req.raw),
    },
  );
  if (!deleted) return context.body(null, 404);
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

async function findPublicDrop(
  database: D1Database,
  token: string,
): Promise<DropRow | null> {
  return database
    .prepare(
      `SELECT id, owner_user_id, guest_actor_hash, manage_token_hash,
              public_token, public_token_hash, object_key, original_name,
              content_type, size_bytes, source_size_bytes, storage_encoding,
              encryption, password_hash, max_downloads, download_count,
              expires_at, status, created_at, completed_at
       FROM drops WHERE public_token_hash = ?`,
    )
    .bind(await sha256(token))
    .first<DropRow>();
}

function publicDrop(drop: DropRow, shared: boolean) {
  return publicDropSchema.parse({
    name: drop.original_name,
    contentType: drop.content_type,
    sizeBytes: drop.source_size_bytes ?? drop.size_bytes,
    storedSizeBytes: drop.size_bytes,
    storageEncoding: drop.encryption ?? drop.storage_encoding,
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
    partSizeBytes: PART_SIZE_BYTES,
    shared,
  });
}

function accountDrop(drop: AccountDropRow) {
  return {
    id: drop.id,
    publicToken: drop.public_token,
    name: drop.original_name,
    contentType: drop.content_type,
    sizeBytes: drop.source_size_bytes,
    storedSizeBytes: drop.size_bytes,
    storageEncoding: drop.storage_encoding,
    encryption: drop.encryption,
    maxDownloads: drop.max_downloads,
    downloadCount: drop.download_count,
    expiresAt: drop.expires_at,
    status: drop.status,
    createdAt: drop.created_at,
    completedAt: drop.completed_at,
    protected: Boolean(drop.protected),
    shared: Boolean(drop.shared),
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
    partSizeBytes: PART_SIZE_BYTES,
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
