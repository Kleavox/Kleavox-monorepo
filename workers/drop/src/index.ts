import { abortUpload, app, deleteDrop, finalizeUploadRecord } from "./app";
import type { DropRow, UploadRow } from "./app";
import type { Env } from "./env";

const worker = {
  fetch(request: Request, env: Env, context: ExecutionContext) {
    return app.fetch(request, env, context);
  },
  scheduled(
    _controller: ScheduledController,
    env: Env,
    context: ExecutionContext,
  ): void {
    context.waitUntil(runDropMaintenance(env));
  },
};

export async function runDropMaintenance(env: Env): Promise<void> {
  const staleUploads = await env.DB.prepare(
    `SELECT id, owner_user_id, guest_actor_hash, manage_token_hash,
            public_token, public_token_hash, object_key, r2_upload_id,
            original_name, content_type, size_bytes, part_size_bytes,
            part_count, password_hash, max_downloads, expires_at,
            upload_expires_at, status, created_at
     FROM upload_sessions
     WHERE status IN ('OPENING', 'OPEN')
       AND datetime(upload_expires_at) <= datetime('now')
     LIMIT 100`,
  ).all<UploadRow>();
  for (const upload of staleUploads.results) {
    await abortUpload(env, upload);
  }

  const completingUploads = await env.DB.prepare(
    `SELECT id, object_key FROM upload_sessions
     WHERE status = 'COMPLETING'
       AND datetime(updated_at) <= datetime('now', '-10 minutes')
     LIMIT 100`,
  ).all<{ id: string; object_key: string }>();
  for (const upload of completingUploads.results) {
    if (await env.FILES.head(upload.object_key)) {
      await finalizeUploadRecord(env, upload.id);
    }
  }

  const endedDrops = await env.DB.prepare(
    `SELECT id, owner_user_id, guest_actor_hash, manage_token_hash,
            public_token, public_token_hash, object_key, original_name,
            content_type, size_bytes, password_hash, max_downloads,
            download_count, expires_at, status, created_at, completed_at
     FROM drops
     WHERE status IN ('ACTIVE', 'EXHAUSTED', 'DELETING')
       AND (
         status IN ('EXHAUSTED', 'DELETING')
         OR datetime(expires_at) <= datetime('now')
       )
     LIMIT 100`,
  ).all<DropRow>();
  for (const drop of endedDrops.results) {
    await deleteDrop(
      env,
      drop,
      drop.status === "EXHAUSTED" ? "DOWNLOAD_LIMIT" : "EXPIRED",
    );
  }

  await env.DB.prepare(
    `DELETE FROM upload_sessions
     WHERE status IN ('COMPLETED', 'ABORTED', 'FAILED')
       AND datetime(updated_at) < datetime('now', '-2 days')`,
  ).run();
  await env.DB.prepare(
    `DELETE FROM drops
     WHERE status IN ('DELETED', 'FAILED')
       AND datetime(COALESCE(deleted_at, created_at)) < datetime('now', '-30 days')`,
  ).run();
  await env.DB.prepare(
    `DELETE FROM abuse_reports
     WHERE status != 'OPEN'
       AND datetime(resolved_at) < datetime('now', '-180 days')`,
  ).run();
}

export default worker;
