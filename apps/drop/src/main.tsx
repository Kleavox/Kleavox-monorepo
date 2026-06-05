import { Turnstile } from "@marsidev/react-turnstile";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./drop.css";

interface Policy {
  kind: "guest" | "user";
  maxFileBytes: number;
  maxActiveBytes: number;
  retentionOptions: number[];
  maxDownloads: number;
  defaultDownloads: number;
}

interface SessionResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: "ADMIN" | "USER";
  };
  policy: Policy;
}

interface UploadStart {
  uploadId: string;
  manageToken: string;
  publicToken: string;
  shareUrl: string;
  partSizeBytes: number;
  partCount: number;
  expiresAt: string;
  maxDownloads: number;
}

interface UploadResult {
  publicToken: string;
  shareUrl: string;
  manageToken: string;
  expiresAt: string;
}

interface AccountDrop {
  id: string;
  public_token: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  max_downloads: number | null;
  download_count: number;
  expires_at: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  protected: number;
}

interface PublicDrop {
  name: string;
  contentType: string;
  sizeBytes: number;
  protected: boolean;
  maxDownloads: number | null;
  downloadCount: number;
  remainingDownloads: number | null;
  expiresAt: string;
  createdAt: string;
}

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;

function App() {
  const publicToken = useMemo(() => {
    const match = window.location.pathname.match(/^\/d\/([^/]+)$/u);
    return match?.[1] ? decodeURIComponent(match[1]) : null;
  }, []);

  return publicToken ? <ReceiveView token={publicToken} /> : <SendView />;
}

function SendView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [session, setSession] = useState<SessionResponse>();
  const [accountDrops, setAccountDrops] = useState<AccountDrop[]>([]);
  const [file, setFile] = useState<File>();
  const [dragging, setDragging] = useState(false);
  const [retentionSeconds, setRetentionSeconds] = useState(3600);
  const [maxDownloads, setMaxDownloads] = useState(3);
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<
    "idle" | "preparing" | "uploading" | "finishing"
  >("idle");
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<UploadResult>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    try {
      const response = await fetch("/api/session");
      const nextSession = await readApi<SessionResponse>(response);
      setSession(nextSession);
      setRetentionSeconds(nextSession.policy.retentionOptions.at(-1) ?? 3600);
      setMaxDownloads(nextSession.policy.defaultDownloads);
      if (nextSession.authenticated) await loadAccountDrops();
    } catch {
      setError("Drop could not load your current session.");
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
    if (!session.authenticated && turnstileSiteKey && !turnstileToken) {
      setError("Complete the security check before uploading.");
      return;
    }
    if (password && password.length < 8) {
      setError("Passwords need at least 8 characters.");
      return;
    }

    setError(undefined);
    setResult(undefined);
    setProgress(0);
    setPhase("preparing");
    let start: UploadStart | undefined;

    try {
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          retentionSeconds,
          maxDownloads,
          password: password || undefined,
          turnstileToken,
        }),
      });
      start = await readApi<UploadStart>(response);
      setPhase("uploading");

      let completedBytes = 0;
      for (let partNumber = 1; partNumber <= start.partCount; partNumber += 1) {
        const beginning = (partNumber - 1) * start.partSizeBytes;
        const end = Math.min(beginning + start.partSizeBytes, file.size);
        const part = file.slice(beginning, end);
        await uploadPart(
          start.uploadId,
          partNumber,
          part,
          start.manageToken,
          (loaded) => {
            setProgress(
              Math.min(
                99,
                Math.round(((completedBytes + loaded) / file.size) * 100),
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

      setProgress(100);
      setResult({
        ...completed,
        manageToken: start.manageToken,
      });
      setFile(undefined);
      setPassword("");
      if (inputRef.current) inputRef.current.value = "";
      if (session.authenticated) await loadAccountDrops();
    } catch (reason) {
      if (start) {
        void fetch(`/api/uploads/${start.uploadId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${start.manageToken}` },
        });
      }
      setError(
        reason instanceof Error ? reason.message : "The upload did not finish.",
      );
      setTurnstileToken(undefined);
      setTurnstileKey((value) => value + 1);
    } finally {
      setPhase("idle");
    }
  }

  async function copyShareUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function deleteResultDrop() {
    if (!result) return;
    const response = await fetch(`/api/public/${result.publicToken}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${result.manageToken}` },
    });
    if (!response.ok) {
      setError("This drop could not be deleted.");
      return;
    }
    setResult(undefined);
  }

  async function deleteDrop(drop: AccountDrop) {
    const response = await fetch(`/api/public/${drop.public_token}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setError("That drop could not be deleted.");
      return;
    }
    setAccountDrops((items) => items.filter((item) => item.id !== drop.id));
  }

  const policy = session?.policy;
  const busy = phase !== "idle";

  return (
    <main className="drop-page">
      <Header
        accountLabel={
          session?.authenticated
            ? session.user?.name || session.user?.email
            : undefined
        }
      />

      <section className="drop-hero">
        <div className="drop-hero-copy">
          <p className="drop-kicker">Temporary file transfer</p>
          <h1>
            Send it.
            <br />
            Let it disappear.
          </h1>
          <p className="drop-intro">
            A private handoff with a built-in ending. No permanent drive, no
            forgotten folder.
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
            <label className="drop-password">
              <span>
                Password <i>optional</i>
              </span>
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                placeholder="At least 8 characters"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>

          {!session?.authenticated && (
            <div className="drop-challenge">
              {turnstileSiteKey ? (
                <Turnstile
                  key={turnstileKey}
                  siteKey={turnstileSiteKey}
                  onSuccess={setTurnstileToken}
                  onExpire={() => setTurnstileToken(undefined)}
                  options={{ theme: "light", size: "flexible" }}
                />
              ) : (
                <p>Security challenge is bypassed in local development.</p>
              )}
            </div>
          )}

          {busy && (
            <div className="drop-progress" aria-live="polite">
              <div>
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                {phase === "preparing"
                  ? "Reserving space"
                  : phase === "finishing"
                    ? "Sealing the drop"
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
            {busy ? "Transfer in progress" : "Create drop"}
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
            <p className="drop-kicker">Drop ready</p>
            <h2>The clock is running.</h2>
            <p>
              This link ends {formatDate(result.expiresAt)}. Keep this tab open
              if you may need to delete it early.
            </p>
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

      <section className="drop-ledger">
        <div className="drop-ledger-heading">
          <div>
            <p className="drop-kicker">Current handoffs</p>
            <h2>
              {session?.authenticated ? "Your active drops" : "Built to end"}
            </h2>
          </div>
          {!session?.authenticated && (
            <a href="https://pass.zarkiv.com/login?returnTo=https%3A%2F%2Fdrop.zarkiv.com">
              Sign in for 24 hour drops
            </a>
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
                      {formatBytes(drop.size_bytes)} / {drop.download_count} of{" "}
                      {drop.max_downloads ?? "unlimited"} downloads
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
                        onClick={() =>
                          void copyShareUrl(
                            `${window.location.origin}/d/${drop.public_token}`,
                          )
                        }
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
              No drops yet. Your next completed transfer will appear here.
            </p>
          )
        ) : (
          <div className="drop-principles">
            <p>Guest files live for one hour and allow up to five downloads.</p>
            <p>
              Account files can live for one day, with a larger transfer limit.
            </p>
            <p>
              Every object is removed when time or download allowance runs out.
            </p>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

function ReceiveView({ token }: { token: string }) {
  const [drop, setDrop] = useState<PublicDrop>();
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
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
      const response = await fetch(`/api/public/${token}`);
      setDrop(await readApi<PublicDrop>(response));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "This drop is unavailable.",
      );
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
                <div>
                  <dt>Downloads left</dt>
                  <dd>{drop.remainingDownloads ?? "No limit"}</dd>
                </div>
                <div>
                  <dt>Protection</dt>
                  <dd>{drop.protected ? "Password" : "Link access"}</dd>
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

              {error && <p className="drop-message is-error">{error}</p>}
              <button
                className="drop-primary"
                type="button"
                disabled={unlocking || (drop.protected && !password)}
                onClick={() => void download()}
              >
                {unlocking ? "Checking access" : "Download file"}
              </button>
              <p className="drop-download-note">
                A successful download uses one allowance.
              </p>
            </div>
          </>
        ) : (
          <div className="drop-gone">
            <p className="drop-kicker">Drop ended</p>
            <h1>Nothing remains here.</h1>
            <p>{error || "The file expired or reached its download limit."}</p>
            <a href="/">Create a new drop</a>
          </div>
        )}
      </section>

      {drop && (
        <section className="drop-report">
          {reportOpen ? (
            <div className="drop-report-form">
              <div>
                <h2>Report this drop</h2>
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
              {reported ? "Report received" : "Report this drop"}
            </button>
          )}
        </section>
      )}
      <Footer />
    </main>
  );
}

function Header({ accountLabel }: { accountLabel?: string }) {
  return (
    <header className="drop-header">
      <a className="drop-brand" href="https://zarkiv.com">
        Zarkiv <span>Drop</span>
      </a>
      <nav>
        <a href="/">Send</a>
        {accountLabel ? (
          <a href="https://pass.zarkiv.com">{accountLabel}</a>
        ) : (
          <a href="https://pass.zarkiv.com/login?returnTo=https%3A%2F%2Fdrop.zarkiv.com">
            Sign in
          </a>
        )}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="drop-footer">
      <p>Zarkiv Drop is temporary by design.</p>
      <div>
        <a href="https://zarkiv.com/privacy">Privacy</a>
        <a href="https://zarkiv.com/terms">Terms</a>
      </div>
    </footer>
  );
}

function uploadPart(
  uploadId: string,
  partNumber: number,
  part: Blob,
  manageToken: string,
  onProgress: (loaded: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", `/api/uploads/${uploadId}/parts/${partNumber}`);
    request.setRequestHeader("Authorization", `Bearer ${manageToken}`);
    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onerror = () =>
      reject(new Error("Network interrupted the upload."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(part.size);
        resolve();
        return;
      }
      let message = "A file part could not be uploaded.";
      try {
        message =
          (JSON.parse(request.responseText) as { message?: string }).message ??
          message;
      } catch {
        // Keep the bounded fallback message.
      }
      reject(new Error(message));
    };
    request.send(part);
  });
}

async function readApi<T = unknown>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  if (!response.ok) {
    throw new Error(payload.message || "The request could not be completed.");
  }
  return payload as T;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB"];
  let value = bytes / 1024;
  let unit = units[0]!;
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index]!;
  }
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${unit}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  const hours = Math.round(seconds / 3600);
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
