import { ApiError, readApiResponse as readApi } from "@kleavox/core";
import {
  createStreamDecryptor,
  decodeBase64Url,
  deriveLoginKeys,
  unsealWithPrivateKey,
  unwrapPrivateKey,
} from "@kleavox/crypto";
import { ErrorScreen, LINK_ORIGIN, signInUrl } from "@kleavox/ui";
import { useEffect, useState } from "react";

import { dropKeyFromHash } from "./e2e";
import { Footer, Header } from "./files-chrome";
import {
  formatBytes,
  formatDate,
  formatPercentSaved,
  receiveFailureCopy,
} from "./files-format";
import type { PublicDrop } from "./files-types";

export function ReceiveView({ token }: { token: string }) {
  const [drop, setDrop] = useState<PublicDrop>();
  const [session, setSession] = useState<{ authenticated: boolean }>();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loadFailure, setLoadFailure] = useState<{
    code?: string;
    message: string;
  }>();
  const [unlocking, setUnlocking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("MALWARE");
  const [reportDetails, setReportDetails] = useState("");
  const [reported, setReported] = useState(false);

  useEffect(() => {
    void loadDrop();
  }, [token]);

  async function loadDrop() {
    setLoading(true);
    try {
      const [dropResponse, sessionResponse] = await Promise.all([
        fetch(`/api/public/${token}`),
        fetch("/api/drop/session").catch(() => null),
      ]);
      let authenticated = false;
      if (sessionResponse?.ok) {
        try {
          authenticated = (
            (await sessionResponse.json()) as { authenticated: boolean }
          ).authenticated;
        } catch {}
      }
      setSession({ authenticated });
      setDrop(await readApi<PublicDrop>(dropResponse));
    } catch (reason) {
      setLoadFailure({
        code: reason instanceof ApiError ? reason.code : undefined,
        message:
          reason instanceof Error
            ? reason.message
            : "This transfer is unavailable.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function download() {
    if (!drop) return;
    setError(undefined);
    if (drop.protected) {
      setUnlocking(true);
      try {
        const response = await fetch(`/api/public/${token}/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        await readApi(response);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "The password is invalid.",
        );
        setUnlocking(false);
        return;
      }
    }

    if (drop.storageEncoding === "aes-256-gcm") {
      let keyBytes: Uint8Array<ArrayBuffer>;
      let saver: FileSaver | null = null;
      if (drop.shared) {
        if (!session?.authenticated) {
          setError("Sign in to open this private transfer.");
          return;
        }
        try {
          keyBytes = await resolveSealedKey(token, password);
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The decryption key is unavailable.",
          );
          return;
        }
      } else {
        const fragmentKey = dropKeyFromHash(window.location.hash);
        if (!fragmentKey) {
          setError("The decryption key is missing from this link.");
          return;
        }
        keyBytes = decodeBase64Url(fragmentKey);
        try {
          saver = await chooseFileSaver(drop.name);
        } catch {
          return;
        }
      }
      setUnlocking(true);
      try {
        const response = await fetch(`/api/public/${token}/download`);
        if (!response.ok) throw new Error("Download failed");
        if (!response.body) {
          const sealed = new Uint8Array(await response.arrayBuffer());
          saveBlob(
            await bufferedDecrypt(
              sealed,
              keyBytes,
              drop.partSizeBytes,
              drop.contentType,
            ),
            drop.name,
          );
        } else if (saver) {
          const sink = saver;
          await streamDecrypt(
            response.body,
            keyBytes,
            drop.partSizeBytes,
            (chunk) => sink.write(chunk),
          );
          await sink.close();
        } else {
          const parts: BlobPart[] = [];
          await streamDecrypt(
            response.body,
            keyBytes,
            drop.partSizeBytes,
            (chunk) => {
              parts.push(new Blob([chunk]));
            },
          );
          saveBlob(new Blob(parts, { type: drop.contentType }), drop.name);
        }
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "Decryption failed.",
        );
      } finally {
        setUnlocking(false);
      }
      return;
    }

    window.location.assign(`/api/public/${token}/download`);
    setUnlocking(false);
  }

  async function submitReport() {
    setError(undefined);
    try {
      const response = await fetch(`/api/public/${token}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails || undefined,
        }),
      });
      await readApi(response);
      setReported(true);
      setReportOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The report was not sent.",
      );
    }
  }

  if (!loading && !drop) {
    const failure = receiveFailureCopy(loadFailure);
    return (
      <ErrorScreen
        code={failure.code}
        title={failure.kicker}
        message={
          loadFailure?.message ||
          "The file expired or reached its download limit."
        }
        homeHref={LINK_ORIGIN}
        homeLabel="Share another file"
      />
    );
  }

  return (
    <main className="drop-page drop-receive-page">
      <Header />
      <section className="drop-receive">
        {loading ? (
          <div className="drop-receive-loading">
            <span />
            <span />
            <span />
          </div>
        ) : drop ? (
          <>
            <div className="drop-receive-copy">
              <p className="drop-kicker">A file was left for you</p>
              <h1>{drop.name}</h1>
              <p>
                It disappears {formatDate(drop.expiresAt)} or when the download
                allowance reaches zero.
              </p>
            </div>

            <div className="drop-receipt">
              <dl>
                <div>
                  <dt>Size</dt>
                  <dd>{formatBytes(drop.sizeBytes)}</dd>
                </div>
                {drop.compressed && (
                  <div>
                    <dt>Stored</dt>
                    <dd>
                      {formatBytes(drop.storedSizeBytes)} /{" "}
                      {formatPercentSaved(drop.sizeBytes, drop.storedSizeBytes)}{" "}
                      smaller
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Downloads left</dt>
                  <dd>{drop.remainingDownloads ?? "No limit"}</dd>
                </div>
                <div>
                  <dt>Protection</dt>
                  <dd>
                    {drop.storageEncoding === "aes-256-gcm"
                      ? "End-to-end encrypted"
                      : drop.protected
                        ? "Password"
                        : "Link access"}
                  </dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{formatDate(drop.expiresAt)}</dd>
                </div>
              </dl>

              {drop.protected && (
                <label className="drop-unlock">
                  <span>Password</span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    placeholder="Enter the shared password"
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void download();
                    }}
                  />
                </label>
              )}

              {drop.shared &&
                (session?.authenticated ? (
                  <label className="drop-unlock">
                    <span>Your account password</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      placeholder="Unlock with your password"
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void download();
                      }}
                    />
                  </label>
                ) : (
                  <p className="drop-message">
                    <a href={signInUrl()}>Sign in</a> to open this private
                    transfer.
                  </p>
                ))}

              {error && <p className="drop-message is-error">{error}</p>}
              <button
                className="drop-primary"
                type="button"
                disabled={
                  unlocking ||
                  (drop.protected && !password) ||
                  (drop.shared && (!session?.authenticated || !password))
                }
                onClick={() => void download()}
              >
                {unlocking ? "Checking access" : "Download file"}
              </button>
              <p className="drop-download-note">
                A successful download uses one allowance.
              </p>
            </div>
          </>
        ) : null}
      </section>

      {drop && (
        <section className="drop-report">
          {reportOpen ? (
            <div className="drop-report-form">
              <div>
                <h2>Report this transfer</h2>
                <button type="button" onClick={() => setReportOpen(false)}>
                  Close
                </button>
              </div>
              <select
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
              >
                <option value="MALWARE">Malware or harmful file</option>
                <option value="COPYRIGHT">Copyright concern</option>
                <option value="HARASSMENT">Harassment or abuse</option>
                <option value="OTHER">Other</option>
              </select>
              <textarea
                maxLength={500}
                placeholder="Optional details"
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
              />
              <button
                className="drop-secondary"
                type="button"
                onClick={() => void submitReport()}
              >
                Send report
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={reported}
              onClick={() => setReportOpen(true)}
            >
              {reported ? "Report received" : "Report this transfer"}
            </button>
          )}
        </section>
      )}
      <Footer />
    </main>
  );
}

async function resolveSealedKey(
  token: string,
  password: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const accountKey = (await (await fetch("/api/drop/account-key")).json()) as {
    salt: string | null;
    wrappedPrivateKey: string | null;
  };
  if (!accountKey.salt || !accountKey.wrappedPrivateKey) {
    throw new Error("Your account has no encryption key set up.");
  }
  const { masterKey } = await deriveLoginKeys(password, accountKey.salt);
  let privateKey: CryptoKey;
  try {
    privateKey = await unwrapPrivateKey(
      accountKey.wrappedPrivateKey,
      masterKey,
    );
  } catch {
    throw new Error("Incorrect account password.");
  }
  const response = await fetch(`/api/public/${token}/sealed-key`);
  if (response.status === 404) {
    throw new Error("This transfer was not shared with your account.");
  }
  if (!response.ok) {
    throw new Error("Could not load the transfer key.");
  }
  const { sealedKey } = (await response.json()) as { sealedKey: string };
  return unsealWithPrivateKey(sealedKey, privateKey);
}

interface FileSaver {
  write(chunk: Uint8Array<ArrayBuffer>): Promise<void>;
  close(): Promise<void>;
}

interface SaveFilePicker {
  showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{
    createWritable: () => Promise<{
      write: (data: BufferSource) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

async function chooseFileSaver(name: string): Promise<FileSaver | null> {
  const picker = window as unknown as SaveFilePicker;
  if (!picker.showSaveFilePicker) return null;
  const handle = await picker.showSaveFilePicker({ suggestedName: name });
  const writable = await handle.createWritable();
  return {
    write: (chunk) => writable.write(chunk),
    close: () => writable.close(),
  };
}

function concatBytes(
  left: Uint8Array,
  right: Uint8Array,
): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

async function streamDecrypt(
  body: ReadableStream<Uint8Array>,
  key: Uint8Array,
  partSize: number,
  onChunk: (plain: Uint8Array<ArrayBuffer>) => Promise<void> | void,
): Promise<void> {
  const decryptor = await createStreamDecryptor(key);
  const reader = body.getReader();
  let buffer = new Uint8Array(0);
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer = concatBytes(buffer, value);
      while (buffer.length > partSize) {
        await onChunk(decryptor.push(buffer.subarray(0, partSize), false));
        buffer = buffer.subarray(partSize);
      }
      if (done) break;
    }
    await onChunk(decryptor.push(buffer, true));
  } finally {
    decryptor.free();
  }
}

async function bufferedDecrypt(
  sealed: Uint8Array,
  key: Uint8Array,
  partSize: number,
  contentType: string,
): Promise<Blob> {
  const decryptor = await createStreamDecryptor(key);
  const chunkCount = Math.max(1, Math.ceil(sealed.length / partSize));
  const parts: BlobPart[] = [];
  try {
    for (let index = 0; index < chunkCount; index += 1) {
      const from = index * partSize;
      const to = Math.min(from + partSize, sealed.length);
      parts.push(
        decryptor.push(
          sealed.subarray(from, to),
          index === chunkCount - 1,
        ) as BlobPart,
      );
    }
  } finally {
    decryptor.free();
  }
  return new Blob(parts, { type: contentType });
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
