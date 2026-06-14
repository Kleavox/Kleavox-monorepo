import { prepareUpload, type PreparedUpload } from "@kleavox/compression";
import {
  ApiError,
  displayHandle,
  readApiResponse as readApi,
} from "@kleavox/core";
import { encrypt } from "@kleavox/crypto";
import { LINK_ORIGIN, challengeUrl, signInUrl } from "@kleavox/ui";
import { useEffect, useRef, useState } from "react";

import { Footer, Header } from "./files-chrome";
import {
  formatBytes,
  formatDate,
  formatDuration,
  formatPercentSaved,
  publicShareUrl,
  uploadPart,
} from "./files-format";
import type {
  AccountDrop,
  SessionResponse,
  UploadResult,
  UploadStart,
} from "./files-types";
import { dropKeyStorageKey, encryptedShareUrl, generateDropKey } from "./e2e";

export function SendView({
  embedded,
  onChanged,
}: {
  embedded: boolean;
  onChanged?: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<SessionResponse>();
  const [accountDrops, setAccountDrops] = useState<AccountDrop[]>([]);
  const [file, setFile] = useState<File>();
  const [dragging, setDragging] = useState(false);
  const [retentionSeconds, setRetentionSeconds] = useState(3600);
  const [maxDownloads, setMaxDownloads] = useState(3);
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<
    "idle" | "optimizing" | "preparing" | "uploading" | "finishing"
  >("idle");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<UploadResult>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch("/api/drop/session");
      const nextSession = await readApi<SessionResponse>(response);
      setSession(nextSession);
      setRetentionSeconds(nextSession.policy.retentionOptions.at(-1) ?? 3600);
      setMaxDownloads(nextSession.policy.defaultDownloads);
      if (nextSession.authenticated && !embedded) await loadAccountDrops();
    } catch {
      setError("Files could not load your current session.");
    }
  }

  async function loadAccountDrops() {
    const response = await fetch("/api/drops");
    if (!response.ok) return;
    const payload = (await response.json()) as { drops: AccountDrop[] };
    setAccountDrops(payload.drops);
  }

  function chooseFile(nextFile?: File) {
    setError(undefined);
    setResult(undefined);
    if (!nextFile) {
      setFile(undefined);
      return;
    }
    const policy = session?.policy;
    if (policy && nextFile.size > policy.maxFileBytes) {
      setError(`That file is larger than ${formatBytes(policy.maxFileBytes)}.`);
      return;
    }
    if (nextFile.size === 0) {
      setError("Empty files cannot be shared.");
      return;
    }
    setFile(nextFile);
  }

  async function sendFile() {
    if (!file || !session || phase !== "idle") return;

    setError(undefined);
    setResult(undefined);
    setProgress(0);
    setPhase("optimizing");
    let start: UploadStart | undefined;
    let dropKey: string | undefined;

    try {
      let prepared: PreparedUpload;
      if (encryptEnabled) {
        dropKey = generateDropKey();
        const buffer = new Uint8Array(await file.arrayBuffer());
        const encrypted = await encrypt(buffer, dropKey);
        prepared = {
          body: new Blob([encrypted as any], {
            type: "application/octet-stream",
          }),
          originalSizeBytes: file.size,
          storedSizeBytes: encrypted.byteLength,
          storageEncoding: "aes-256-gcm",
          savedBytes: 0,
        };
      } else {
        prepared = await prepareUpload(file);
      }
      setPhase("preparing");
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: prepared.originalSizeBytes,
          storedSizeBytes: prepared.storedSizeBytes,
          storageEncoding: prepared.storageEncoding,
          retentionSeconds,
          maxDownloads,
        }),
      });
      start = await readApi<UploadStart>(response);
      setPhase("uploading");

      let completedBytes = 0;
      for (let partNumber = 1; partNumber <= start.partCount; partNumber += 1) {
        const beginning = (partNumber - 1) * start.partSizeBytes;
        const end = Math.min(
          beginning + start.partSizeBytes,
          prepared.storedSizeBytes,
        );
        const part = prepared.body.slice(beginning, end);
        await uploadPart(
          start.uploadId,
          partNumber,
          part,
          start.manageToken,
          (loaded) => {
            setProgress(
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

      setPhase("finishing");
      const completeResponse = await fetch(
        `/api/uploads/${start.uploadId}/complete`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${start.manageToken}` },
        },
      );
      const completed = await readApi<{
        publicToken: string;
        shareUrl: string;
        expiresAt: string;
      }>(completeResponse);

      const shareUrl = dropKey
        ? encryptedShareUrl(completed.shareUrl, dropKey)
        : completed.shareUrl;
      if (dropKey) {
        localStorage.setItem(dropKeyStorageKey(completed.publicToken), dropKey);
      }

      setProgress(100);
      setResult({
        ...completed,
        shareUrl,
        manageToken: start.manageToken,
        savedBytes: prepared.savedBytes,
        encrypted: Boolean(dropKey),
      });
      setFile(undefined);
      setEncryptEnabled(false);
      if (inputRef.current) inputRef.current.value = "";
      if (session.authenticated) {
        if (embedded) await onChanged?.();
        else await loadAccountDrops();
      }
    } catch (reason) {
      if (start) {
        void fetch(`/api/uploads/${start.uploadId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${start.manageToken}` },
        });
      }
      if (reason instanceof ApiError && reason.code === "CHALLENGE_FAILED") {
        window.location.assign(challengeUrl("basic"));
        return;
      }
      setError(
        reason instanceof Error ? reason.message : "The upload did not finish.",
      );
    } finally {
      setPhase("idle");
    }
  }

  async function copyShareUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function copyAccountDrop(drop: AccountDrop) {
    const base = publicShareUrl(drop.public_token);
    if (drop.encryption !== "aes-256-gcm") {
      await copyShareUrl(base);
      return;
    }
    const key = localStorage.getItem(dropKeyStorageKey(drop.public_token));
    if (!key) {
      setError(
        "The encryption key for this transfer is not stored on this device.",
      );
      return;
    }
    await copyShareUrl(encryptedShareUrl(base, key));
  }

  async function deleteResultDrop() {
    if (!result) return;
    const response = await fetch(`/api/public/${result.publicToken}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${result.manageToken}` },
    });
    if (!response.ok) {
      setError("This transfer could not be deleted.");
      return;
    }
    localStorage.removeItem(dropKeyStorageKey(result.publicToken));
    setResult(undefined);
    await onChanged?.();
  }

  async function deleteDrop(drop: AccountDrop) {
    const response = await fetch(`/api/public/${drop.public_token}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("That transfer could not be deleted.");
      return;
    }
    localStorage.removeItem(dropKeyStorageKey(drop.public_token));
    setAccountDrops((items) => items.filter((item) => item.id !== drop.id));
  }

  const policy = session?.policy;
  const busy = phase !== "idle";
  const Root = embedded ? "section" : "main";

  return (
    <Root className={`drop-page${embedded ? " drop-embedded" : ""}`}>
      {!embedded && (
        <Header
          accountLabel={
            session?.authenticated
              ? displayHandle(session.user?.username, session.user?.email)
              : undefined
          }
        />
      )}

      <section className="drop-hero">
        <div className="drop-hero-copy">
          {embedded && <span className="drop-create-index">02</span>}
          <p className="drop-kicker">TEMPORARY FILE</p>
          {embedded ? (
            <h2>Drop the file itself.</h2>
          ) : (
            <h1>
              Send it.
              <br />
              Let it disappear.
            </h1>
          )}
          <p className="drop-intro">
            Time and download limits are built into the address.
          </p>
        </div>

        <div className="drop-station">
          <div
            className={`drop-zone${dragging ? " is-dragging" : ""}${file ? " has-file" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files[0]);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              disabled={busy}
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
            {file ? (
              <div className="drop-file">
                <div>
                  <p className="drop-file-name">{file.name}</p>
                  <p className="drop-file-meta">
                    {formatBytes(file.size)} / ready to transfer
                  </p>
                </div>
                {!busy && (
                  <button
                    className="drop-text-button"
                    type="button"
                    onClick={() => chooseFile(undefined)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <button
                className="drop-zone-action"
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={!session}
              >
                <span className="drop-zone-mark">+</span>
                <span>
                  <strong>Choose a file</strong>
                  <small>or place it anywhere in this area</small>
                </span>
              </button>
            )}
          </div>

          <div className="drop-options">
            <label>
              <span>Available for</span>
              <select
                value={retentionSeconds}
                disabled={!policy || busy}
                onChange={(event) =>
                  setRetentionSeconds(Number(event.target.value))
                }
              >
                {(policy?.retentionOptions ?? [3600]).map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatDuration(seconds)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Downloads</span>
              <input
                type="number"
                min={1}
                max={policy?.maxDownloads ?? 5}
                value={maxDownloads}
                disabled={!policy || busy}
                onChange={(event) =>
                  setMaxDownloads(Number(event.target.value))
                }
              />
            </label>
            <label className="drop-encrypt">
              <span>
                End-to-end encrypt <i>optional</i>
              </span>
              <input
                type="checkbox"
                checked={encryptEnabled}
                disabled={busy}
                onChange={(event) => setEncryptEnabled(event.target.checked)}
              />
            </label>
          </div>

          {busy && (
            <div className="drop-progress" aria-live="polite">
              <div>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                {phase === "preparing"
                  ? "Reserving space"
                  : phase === "optimizing"
                    ? "Optimizing locally with Rust"
                    : phase === "finishing"
                      ? "Preparing the transfer"
                      : `Transferring ${progress}%`}
              </p>
            </div>
          )}

          {error && <p className="drop-message is-error">{error}</p>}

          <button
            className="drop-primary"
            type="button"
            disabled={!file || !session || busy}
            onClick={() => void sendFile()}
          >
            {busy ? "Transfer in progress" : "Create transfer"}
          </button>

          <div className="drop-rule">
            <span>
              {policy
                ? `${formatBytes(policy.maxFileBytes)} max`
                : "Checking limit"}
            </span>
            <span>Encrypted in transit</span>
            <span>Automatic deletion</span>
          </div>
        </div>
      </section>

      {result && (
        <section className="drop-result" aria-live="polite">
          <div>
            <p className="drop-kicker">File ready</p>
            <h2>The clock is running.</h2>
            <p>
              This link ends {formatDate(result.expiresAt)}. Keep this tab open
              if you may need to delete it early.
            </p>
            {result.savedBytes > 0 && (
              <p className="drop-compression">
                Rust compression saved {formatBytes(result.savedBytes)} in
                storage.
              </p>
            )}
            {result.encrypted && (
              <p className="drop-compression">
                End-to-end encrypted. The key lives only in this link — copy it
                now.
              </p>
            )}
            <button
              className="drop-delete-result"
              type="button"
              onClick={() => void deleteResultDrop()}
            >
              Delete now
            </button>
          </div>
          <div className="drop-share-line">
            <input readOnly value={result.shareUrl} aria-label="Share URL" />
            <button
              type="button"
              onClick={() => void copyShareUrl(result.shareUrl)}
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </section>
      )}

      {!embedded && (
        <section className="drop-ledger">
          <div className="drop-ledger-heading">
            <div>
              <p className="drop-kicker">Current handoffs</p>
              <h2>
                {session?.authenticated
                  ? "Your active transfers"
                  : "Built to end"}
              </h2>
            </div>
            {!session?.authenticated && (
              <a href={signInUrl(LINK_ORIGIN)}>Sign in for 24 hour transfers</a>
            )}
          </div>

          {session?.authenticated ? (
            accountDrops.length ? (
              <div className="drop-list">
                {accountDrops.map((drop) => (
                  <article key={drop.id} className="drop-row">
                    <div className="drop-row-main">
                      <p>{drop.original_name}</p>
                      <span>
                        {formatBytes(drop.source_size_bytes)} /{" "}
                        {drop.download_count} of{" "}
                        {drop.max_downloads ?? "unlimited"} downloads
                        {drop.storage_encoding === "gzip"
                          ? ` / ${formatPercentSaved(
                              drop.source_size_bytes,
                              drop.size_bytes,
                            )} smaller`
                          : ""}
                      </span>
                    </div>
                    <div className="drop-row-state">
                      <span
                        className={`drop-status is-${drop.status.toLowerCase()}`}
                      >
                        {drop.status}
                      </span>
                      <time>{formatDate(drop.expires_at)}</time>
                    </div>
                    <div className="drop-row-actions">
                      {drop.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => void copyAccountDrop(drop)}
                        >
                          Copy
                        </button>
                      )}
                      {!["DELETED", "FAILED"].includes(drop.status) && (
                        <button
                          type="button"
                          onClick={() => void deleteDrop(drop)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="drop-empty">
                No transfers yet. Your next completed transfer will appear here.
              </p>
            )
          ) : (
            <div className="drop-principles">
              <p>
                Guest files live for one hour and allow up to five downloads.
              </p>
              <p>
                Account files can live for one day, with a larger transfer
                limit.
              </p>
              <p>
                Every object is removed when time or download allowance runs
                out.
              </p>
            </div>
          )}
        </section>
      )}

      {!embedded && <Footer />}
    </Root>
  );
}
