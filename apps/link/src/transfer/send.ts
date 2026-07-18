import { prepareUpload, type PreparedUpload } from "@kleavox/compression";
import { readApiResponse as readApi } from "@kleavox/core";
import {
  STREAM_CHUNK_OVERHEAD,
  createStreamEncryptor,
  decodeBase64Url,
  sealToPublicKey,
} from "@kleavox/crypto";

import { dropKeyStorageKey, encryptedShareUrl, generateDropKey } from "../e2e";
import { uploadPart } from "../files-format";
import type {
  SessionResponse,
  UploadResult,
  UploadStart,
} from "../files-types";

export type TransferPhase =
  | "idle"
  | "optimizing"
  | "preparing"
  | "uploading"
  | "finishing";

export interface SendTransferInput {
  file: File;
  session: SessionResponse;
  retentionSeconds: number;
  maxDownloads: number;
  recipients: string;
  onPhase?: (phase: Exclude<TransferPhase, "idle">) => void;
  onProgress?: (percentage: number) => void;
}

interface CompletedUpload {
  publicToken: string;
  shareUrl: string;
  expiresAt: string;
}

interface PreparedTransfer {
  recipientPayload?: { userId: string; sealedKey: string }[];
  compressed: PreparedUpload | null;
  keyBytes?: Uint8Array<ArrayBuffer>;
  chunkPlaintext: number;
  storedSizeBytes: number;
  storageEncoding?: "gzip" | "aes-256-gcm";
  savedBytes: number;
  dropKey?: string;
}

export async function sendTransfer(
  input: SendTransferInput,
): Promise<UploadResult> {
  input.onPhase?.("optimizing");
  const recipientNames = normalizeRecipients(input.recipients);
  let start: UploadStart | undefined;

  try {
    const prepared = await prepareTransfer(
      input.file,
      input.session,
      recipientNames,
    );

    input.onPhase?.("preparing");
    start = await reserveUpload(input, prepared);
    input.onPhase?.("uploading");
    await transferParts(input.file, start, prepared, input.onProgress);

    input.onPhase?.("finishing");
    const completed = await completeUpload(start);
    const shareUrl = prepared.dropKey
      ? encryptedShareUrl(completed.shareUrl, prepared.dropKey)
      : completed.shareUrl;
    if (prepared.dropKey) {
      localStorage.setItem(
        dropKeyStorageKey(completed.publicToken),
        prepared.dropKey,
      );
    }

    input.onProgress?.(100);
    return {
      ...completed,
      shareUrl,
      manageToken: start.manageToken,
      savedBytes: prepared.savedBytes,
      encrypted: Boolean(prepared.keyBytes),
    };
  } catch (error) {
    if (start) await abortUpload(start);
    throw error;
  }
}

async function prepareTransfer(
  file: File,
  session: SessionResponse,
  recipients: string[],
): Promise<PreparedTransfer> {
  if (!session.authenticated) {
    const compressed = await prepareUpload(file);
    return {
      compressed,
      chunkPlaintext: 0,
      storedSizeBytes: compressed.storedSizeBytes,
      storageEncoding: compressed.storageEncoding,
      savedBytes: compressed.savedBytes,
    };
  }

  let keyBytes: Uint8Array<ArrayBuffer>;
  let dropKey: string | undefined;
  let recipientPayload: PreparedTransfer["recipientPayload"];
  if (recipients.length > 0) {
    keyBytes = crypto.getRandomValues(new Uint8Array(32));
    recipientPayload = await sealForRecipients(keyBytes, recipients);
  } else {
    dropKey = generateDropKey();
    keyBytes = decodeBase64Url(dropKey);
  }

  const chunkPlaintext = session.policy.partSizeBytes - STREAM_CHUNK_OVERHEAD;
  const chunkCount = Math.max(1, Math.ceil(file.size / chunkPlaintext));
  return {
    recipientPayload,
    compressed: null,
    keyBytes,
    chunkPlaintext,
    storedSizeBytes: file.size + STREAM_CHUNK_OVERHEAD * chunkCount,
    storageEncoding: "aes-256-gcm",
    savedBytes: 0,
    dropKey,
  };
}

async function sealForRecipients(
  fileKey: Uint8Array<ArrayBuffer>,
  usernames: string[],
): Promise<{ userId: string; sealedKey: string }[]> {
  return Promise.all(
    usernames.map(async (username) => {
      const response = await fetch(
        `/api/drop/recipient-key?username=${encodeURIComponent(username)}`,
      );
      const data = (await response.json()) as {
        userId: string | null;
        publicKey: string | null;
      };
      if (!data.userId || !data.publicKey) {
        throw new Error(
          `Can't share with @${username} — no encryption-ready account.`,
        );
      }
      return {
        userId: data.userId,
        sealedKey: await sealToPublicKey(fileKey, data.publicKey),
      };
    }),
  );
}

async function reserveUpload(
  input: SendTransferInput,
  prepared: PreparedTransfer,
): Promise<UploadStart> {
  const response = await fetch("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      storedSizeBytes: prepared.storedSizeBytes,
      storageEncoding: prepared.storageEncoding,
      retentionSeconds: input.retentionSeconds,
      maxDownloads: input.maxDownloads,
      recipients: prepared.recipientPayload,
    }),
  });
  return readApi<UploadStart>(response);
}

async function transferParts(
  file: File,
  start: UploadStart,
  prepared: PreparedTransfer,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  const encryptor = prepared.keyBytes
    ? await createStreamEncryptor(prepared.keyBytes)
    : null;
  try {
    let completedBytes = 0;
    for (let partNumber = 1; partNumber <= start.partCount; partNumber += 1) {
      const part = encryptor
        ? await encryptedPart(
            file,
            partNumber,
            start.partCount,
            prepared.chunkPlaintext,
            encryptor,
          )
        : compressedPart(
            prepared.compressed!,
            partNumber,
            start.partSizeBytes,
            prepared.storedSizeBytes,
          );
      await uploadPart(
        start.uploadId,
        partNumber,
        part,
        start.manageToken,
        (loaded) => {
          onProgress?.(
            Math.min(
              99,
              Math.round(
                ((completedBytes + loaded) / prepared.storedSizeBytes) * 100,
              ),
            ),
          );
        },
      );
      completedBytes += part.size;
    }
  } finally {
    encryptor?.free();
  }
}

async function encryptedPart(
  file: File,
  partNumber: number,
  partCount: number,
  chunkPlaintext: number,
  encryptor: Awaited<ReturnType<typeof createStreamEncryptor>>,
): Promise<Blob> {
  const from = (partNumber - 1) * chunkPlaintext;
  const to = Math.min(from + chunkPlaintext, file.size);
  const plaintext = new Uint8Array(await file.slice(from, to).arrayBuffer());
  const sealed = encryptor.push(plaintext, partNumber === partCount);
  return new Blob([sealed as BlobPart]);
}

function compressedPart(
  prepared: PreparedUpload,
  partNumber: number,
  partSizeBytes: number,
  storedSizeBytes: number,
): Blob {
  const from = (partNumber - 1) * partSizeBytes;
  const to = Math.min(from + partSizeBytes, storedSizeBytes);
  return prepared.body.slice(from, to);
}

async function completeUpload(start: UploadStart): Promise<CompletedUpload> {
  const response = await fetch(`/api/uploads/${start.uploadId}/complete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${start.manageToken}` },
  });
  return readApi<CompletedUpload>(response);
}

async function abortUpload(start: UploadStart): Promise<void> {
  try {
    await fetch(`/api/uploads/${start.uploadId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${start.manageToken}` },
    });
  } catch {}
}

function normalizeRecipients(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[\s,]+/u)
        .map((name) => name.trim().replace(/^@/u, "").toLowerCase())
        .filter(Boolean),
    ),
  ];
}
