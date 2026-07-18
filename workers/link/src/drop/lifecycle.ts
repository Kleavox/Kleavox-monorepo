import type { Env } from "../env";
import { readBearerToken, sha256 } from "./lib/crypto";
import { expectedPartSize } from "./lib/limits";

interface UploadRecord {
  id: string;
  owner_user_id: string | null;
  manage_token_hash: string;
  public_token: string;
  object_key: string;
  r2_upload_id: string | null;
  size_bytes: number;
  part_count: number;
  expires_at: string;
  upload_expires_at: string;
  status: string;
}

interface DropRecord {
  id: string;
  owner_user_id: string | null;
  manage_token_hash: string | null;
  object_key: string;
  status: string;
}

interface PartRecord {
  part_number: number;
  etag: string;
  size_bytes: number;
}

type StoreUploadPartResult =
  | { status: "stored"; partNumber: number; etag: string }
  | { status: "not_found" }
  | { status: "closed" }
  | { status: "invalid" }
  | { status: "failed" };

type CompleteUploadResult =
  | {
      status: "completed";
      dropId: string;
      publicToken: string;
      expiresAt: string;
    }
  | { status: "not_found" }
  | { status: "closed" }
  | { status: "incomplete" }
  | { status: "busy" }
  | { status: "pending" }
  | { status: "failed" };

type DeleteDropActor = {
  userId: string | null;
  isAdmin: boolean;
  manageToken: string | null;
};

export interface DropLifecycle {
  storeUploadPart(input: {
    uploadId: string;
    manageToken: string | null;
    partNumber: number;
    contentLength: number;
    body: ReadableStream | null;
  }): Promise<StoreUploadPartResult>;
  completeUpload(
    uploadId: string,
    manageToken: string | null,
  ): Promise<CompleteUploadResult>;
  abortUpload(uploadId: string, manageToken: string | null): Promise<boolean>;
  deletePublicDrop(
    publicToken: string,
    actor: DeleteDropActor,
  ): Promise<boolean>;
  purgeAccount(userId: string): Promise<void>;
  maintain(): Promise<void>;
}

export function createDropLifecycle(env: Env): DropLifecycle {
  return new CloudflareDropLifecycle(env);
}

class CloudflareDropLifecycle implements DropLifecycle {
  constructor(private readonly env: Env) {}

  async storeUploadPart(input: {
    uploadId: string;
    manageToken: string | null;
    partNumber: number;
    contentLength: number;
    body: ReadableStream | null;
  }): Promise<StoreUploadPartResult> {
    const upload = await this.findUpload(input.uploadId);
    if (!upload || !(await this.canManageUpload(upload, input.manageToken))) {
      return { status: "not_found" };
    }
    if (
      upload.status !== "OPEN" ||
      Date.parse(upload.upload_expires_at) <= Date.now() ||
      !upload.r2_upload_id
    ) {
      return { status: "closed" };
    }

    const expectedBytes = expectedPartSize(
      upload.size_bytes,
      input.partNumber,
      upload.part_count,
    );
    if (
      !expectedBytes ||
      !Number.isSafeInteger(input.contentLength) ||
      input.contentLength !== expectedBytes ||
      !input.body
    ) {
      return { status: "invalid" };
    }

    try {
      const multipart = this.env.FILES.resumeMultipartUpload(
        upload.object_key,
        upload.r2_upload_id,
      );
      const part = await multipart.uploadPart(input.partNumber, input.body);
      await this.env.DB.prepare(
        `INSERT INTO upload_parts (upload_id, part_number, etag, size_bytes)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(upload_id, part_number) DO UPDATE SET
           etag = excluded.etag,
           size_bytes = excluded.size_bytes,
           created_at = datetime('now')`,
      )
        .bind(upload.id, input.partNumber, part.etag, input.contentLength)
        .run();
      return {
        status: "stored",
        partNumber: input.partNumber,
        etag: part.etag,
      };
    } catch (error) {
      console.error("Unable to upload R2 part", error);
      return { status: "failed" };
    }
  }

  async completeUpload(
    uploadId: string,
    manageToken: string | null,
  ): Promise<CompleteUploadResult> {
    const upload = await this.findUpload(uploadId);
    if (!upload || !(await this.canManageUpload(upload, manageToken))) {
      return { status: "not_found" };
    }
    if (
      !["OPEN", "COMPLETING"].includes(upload.status) ||
      Date.parse(upload.upload_expires_at) <= Date.now() ||
      !upload.r2_upload_id
    ) {
      return { status: "closed" };
    }

    const parts = (
      await this.env.DB.prepare(
        `SELECT part_number, etag, size_bytes
         FROM upload_parts WHERE upload_id = ? ORDER BY part_number`,
      )
        .bind(upload.id)
        .all<PartRecord>()
    ).results;
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
    if (!validParts) return { status: "incomplete" };

    if (upload.status === "OPEN") {
      const claimed = await this.env.DB.prepare(
        `UPDATE upload_sessions
         SET status = 'COMPLETING', updated_at = datetime('now')
         WHERE id = ? AND status = 'OPEN'`,
      )
        .bind(upload.id)
        .run();
      if ((claimed.meta.changes ?? 0) !== 1) return { status: "busy" };

      try {
        const multipart = this.env.FILES.resumeMultipartUpload(
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
        if (!(await this.env.FILES.head(upload.object_key))) {
          await this.env.DB.prepare(
            `UPDATE upload_sessions
             SET status = 'OPEN', updated_at = datetime('now')
             WHERE id = ? AND status = 'COMPLETING'`,
          )
            .bind(upload.id)
            .run();
          console.error("Unable to complete R2 multipart upload", error);
          return { status: "failed" };
        }
      }
    } else if (!(await this.env.FILES.head(upload.object_key))) {
      return { status: "pending" };
    }

    await this.finalizeUpload(upload.id);
    return {
      status: "completed",
      dropId: upload.id,
      publicToken: upload.public_token,
      expiresAt: upload.expires_at,
    };
  }

  async abortUpload(
    uploadId: string,
    manageToken: string | null,
  ): Promise<boolean> {
    const upload = await this.findUpload(uploadId);
    if (!upload || !(await this.canManageUpload(upload, manageToken))) {
      return false;
    }
    await this.abortRecord(upload);
    return true;
  }

  async deletePublicDrop(
    publicToken: string,
    actor: DeleteDropActor,
  ): Promise<boolean> {
    const drop = await this.findPublicDrop(publicToken);
    if (!drop) return false;

    const manageTokenHash = actor.manageToken
      ? await sha256(actor.manageToken)
      : null;
    const allowed =
      actor.isAdmin ||
      (actor.userId !== null && actor.userId === drop.owner_user_id) ||
      (manageTokenHash !== null && manageTokenHash === drop.manage_token_hash);
    if (!allowed) return false;

    await this.deleteRecord(drop, "OWNER_REQUEST");
    return true;
  }

  async purgeAccount(userId: string): Promise<void> {
    for (let round = 0; round < 20; round += 1) {
      const uploads = await this.listAccountUploads(userId);
      if (uploads.length === 0) break;
      for (const upload of uploads) await this.abortRecord(upload);
    }

    for (let round = 0; round < 20; round += 1) {
      const drops = await this.listAccountDrops(userId);
      if (drops.length === 0) break;
      for (const drop of drops) {
        await this.deleteRecord(drop, "account_deleted");
      }
    }

    await this.env.DB.batch([
      this.env.DB.prepare(
        `DELETE FROM upload_sessions WHERE owner_user_id = ?`,
      ).bind(userId),
      this.env.DB.prepare(
        `DELETE FROM drop_recipients WHERE recipient_user_id = ?`,
      ).bind(userId),
      this.env.DB.prepare(`DELETE FROM drops WHERE owner_user_id = ?`).bind(
        userId,
      ),
    ]);
  }

  async maintain(): Promise<void> {
    const staleUploads = await this.env.DB.prepare(
      `${UPLOAD_RECORD_SELECT}
       WHERE status IN ('OPENING', 'OPEN')
         AND datetime(upload_expires_at) <= datetime('now')
       LIMIT 100`,
    ).all<UploadRecord>();
    await Promise.all(
      staleUploads.results.map((upload) => this.abortRecord(upload)),
    );

    const completingUploads = await this.env.DB.prepare(
      `SELECT id, object_key FROM upload_sessions
       WHERE status = 'COMPLETING'
         AND datetime(updated_at) <= datetime('now', '-10 minutes')
       LIMIT 100`,
    ).all<{ id: string; object_key: string }>();
    await Promise.all(
      completingUploads.results.map(async (upload) => {
        if (await this.env.FILES.head(upload.object_key)) {
          await this.finalizeUpload(upload.id);
        }
      }),
    );

    const endedDrops = await this.env.DB.prepare(
      `${DROP_RECORD_SELECT}
       WHERE status IN ('ACTIVE', 'EXHAUSTED', 'DELETING')
         AND (
           status IN ('EXHAUSTED', 'DELETING')
           OR datetime(expires_at) <= datetime('now')
         )
       LIMIT 100`,
    ).all<DropRecord>();
    await Promise.all(
      endedDrops.results.map((drop) =>
        this.deleteRecord(
          drop,
          drop.status === "EXHAUSTED" ? "DOWNLOAD_LIMIT" : "EXPIRED",
        ),
      ),
    );

    await this.env.DB.prepare(
      `DELETE FROM upload_sessions
       WHERE status IN ('COMPLETED', 'ABORTED', 'FAILED')
         AND datetime(updated_at) < datetime('now', '-2 days')`,
    ).run();
    await this.env.DB.prepare(
      `DELETE FROM drops
       WHERE status IN ('DELETED', 'FAILED')
         AND datetime(COALESCE(deleted_at, created_at)) < datetime('now', '-30 days')`,
    ).run();
    await this.env.DB.prepare(
      `DELETE FROM drop_recipients
       WHERE drop_id NOT IN (SELECT id FROM drops)
         AND drop_id NOT IN (
           SELECT id FROM upload_sessions
           WHERE status IN ('OPENING', 'OPEN', 'COMPLETING')
         )`,
    ).run();
    await this.env.DB.prepare(
      `DELETE FROM abuse_reports
       WHERE status != 'OPEN'
         AND datetime(resolved_at) < datetime('now', '-180 days')`,
    ).run();
    await this.env.DB.prepare(
      `DELETE FROM clicks WHERE clicked_at < datetime('now', '-90 days')`,
    ).run();
  }

  private async findUpload(id: string): Promise<UploadRecord | null> {
    return this.env.DB.prepare(`${UPLOAD_RECORD_SELECT} WHERE id = ?`)
      .bind(id)
      .first<UploadRecord>();
  }

  private async findPublicDrop(token: string): Promise<DropRecord | null> {
    return this.env.DB.prepare(
      `${DROP_RECORD_SELECT} WHERE public_token_hash = ?`,
    )
      .bind(await sha256(token))
      .first<DropRecord>();
  }

  private async listAccountUploads(userId: string): Promise<UploadRecord[]> {
    return (
      await this.env.DB.prepare(
        `${UPLOAD_RECORD_SELECT}
         WHERE owner_user_id = ?
           AND status IN ('OPENING', 'OPEN', 'COMPLETING')
         LIMIT 50`,
      )
        .bind(userId)
        .all<UploadRecord>()
    ).results;
  }

  private async listAccountDrops(userId: string): Promise<DropRecord[]> {
    return (
      await this.env.DB.prepare(
        `${DROP_RECORD_SELECT}
         WHERE owner_user_id = ?
           AND status IN ('ACTIVE', 'EXHAUSTED', 'DELETING')
         LIMIT 50`,
      )
        .bind(userId)
        .all<DropRecord>()
    ).results;
  }

  private async canManageUpload(
    upload: UploadRecord,
    manageToken: string | null,
  ): Promise<boolean> {
    return Boolean(
      manageToken && (await sha256(manageToken)) === upload.manage_token_hash,
    );
  }

  private async finalizeUpload(uploadId: string): Promise<void> {
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT OR IGNORE INTO drops (
           id, owner_user_id, guest_actor_hash, public_token, public_token_hash,
           manage_token_hash, object_key, original_name, content_type, size_bytes,
           source_size_bytes, storage_encoding, encryption, password_hash,
           max_downloads, expires_at, status, created_at, completed_at
         )
         SELECT id, owner_user_id, guest_actor_hash, public_token,
                public_token_hash, manage_token_hash, object_key, original_name,
                content_type, size_bytes, source_size_bytes, storage_encoding,
                encryption, password_hash, max_downloads, expires_at, 'ACTIVE',
                created_at, datetime('now')
         FROM upload_sessions
         WHERE id = ? AND status = 'COMPLETING'`,
      ).bind(uploadId),
      this.env.DB.prepare(
        `UPDATE upload_sessions
         SET status = 'COMPLETED', updated_at = datetime('now')
         WHERE id = ? AND status = 'COMPLETING'`,
      ).bind(uploadId),
    ]);
  }

  private async abortRecord(upload: UploadRecord): Promise<void> {
    const claimed = await this.env.DB.prepare(
      `UPDATE upload_sessions
       SET status = 'ABORTING', updated_at = datetime('now')
       WHERE id = ? AND status IN ('OPENING', 'OPEN', 'COMPLETING')`,
    )
      .bind(upload.id)
      .run();
    if ((claimed.meta.changes ?? 0) !== 1) return;

    if (upload.r2_upload_id) {
      try {
        await this.env.FILES.resumeMultipartUpload(
          upload.object_key,
          upload.r2_upload_id,
        ).abort();
      } catch (error) {
        console.error("Unable to abort multipart upload", error);
      }
    }
    await this.env.DB.prepare(
      `UPDATE upload_sessions
       SET status = 'ABORTED', updated_at = datetime('now') WHERE id = ?`,
    )
      .bind(upload.id)
      .run();
  }

  private async deleteRecord(drop: DropRecord, reason: string): Promise<void> {
    await this.env.DB.prepare(
      `UPDATE drops SET status = 'DELETING', delete_reason = ?
       WHERE id = ? AND status IN ('ACTIVE', 'EXHAUSTED', 'DELETING')`,
    )
      .bind(reason, drop.id)
      .run();
    try {
      await this.env.FILES.delete(drop.object_key);
      await this.env.DB.prepare(
        `UPDATE drops
         SET status = 'DELETED', deleted_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(drop.id)
        .run();
      await this.env.DB.prepare(`DELETE FROM drop_recipients WHERE drop_id = ?`)
        .bind(drop.id)
        .run();
    } catch (error) {
      console.error("Unable to delete R2 object", error);
      throw error;
    }
  }
}

const UPLOAD_RECORD_SELECT = `SELECT id, owner_user_id, manage_token_hash,
  public_token, object_key, r2_upload_id, size_bytes, part_count, expires_at,
  upload_expires_at, status FROM upload_sessions`;

const DROP_RECORD_SELECT = `SELECT id, owner_user_id, manage_token_hash,
  object_key, status FROM drops`;

export function manageToken(request: Request): string | null {
  return readBearerToken(request);
}
