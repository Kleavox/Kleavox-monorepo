import { ApiError, readApiResponse as readApi } from "@kleavox/core";
import { decrypt } from "@kleavox/crypto";
import { ErrorScreen, LINK_ORIGIN } from "@kleavox/ui";
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
      const response = await fetch(`/api/public/${token}`);
      setDrop(await readApi<PublicDrop>(response));
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
      const key = dropKeyFromHash(window.location.hash);
      if (!key) {
        setError("The decryption key is missing from this link.");
        return;
      }
      setUnlocking(true);
      try {
        const response = await fetch(`/api/public/${token}/download`);
        if (!response.ok) throw new Error("Download failed");
        const encryptedBuffer = new Uint8Array(await response.arrayBuffer());
        const decryptedBuffer = await decrypt(encryptedBuffer, key);
        const blob = new Blob([decryptedBuffer as any], {
          type: drop.contentType,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = drop.name;
        a.click();
        URL.revokeObjectURL(url);
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
