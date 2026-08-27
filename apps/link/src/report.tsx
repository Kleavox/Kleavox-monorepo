import { type FormEvent, useEffect, useState } from "react";
import { ApiError, apiFetch as request, errorMessage } from "@kleavox/core";
import {
  AppHeader,
  ROOT_HOST,
  ROOT_ORIGIN,
  challengeUrl,
  loadNavCounts,
} from "@kleavox/ui";
import type { NavCounts } from "@kleavox/ui";

import { clearDraft, readDraft, REPORT_DRAFT_KEY, saveDraft } from "./drafts";
import type { FormState } from "./types";

export function ReportApp() {
  const draft = readDraft<{ slug?: string; reason?: string; details?: string }>(
    REPORT_DRAFT_KEY,
  );
  const [slug, setSlug] = useState(draft?.slug ?? "");
  const [reason, setReason] = useState(draft?.reason ?? "PHISHING");
  const [details, setDetails] = useState(draft?.details ?? "");
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [counts, setCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    void loadNavCounts().then(setCounts);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      await request("/api/reports", {
        method: "POST",
        body: JSON.stringify({ slug, reason, details: details || undefined }),
      });
      clearDraft(REPORT_DRAFT_KEY);
      setSlug("");
      setDetails("");
      setState({ status: "success", message: "Report received." });
    } catch (error) {
      if (error instanceof ApiError && error.code === "CHALLENGE_FAILED") {
        saveDraft(REPORT_DRAFT_KEY, { slug, reason, details });
        window.location.assign(challengeUrl("basic"));
        return;
      }
      setState({ status: "error", message: errorMessage(error) });
    }
  };

  return (
    <div className="link-app">
      <AppHeader product="LINK" rootOrigin={ROOT_ORIGIN} counts={counts} />
      <main className="link-report-page">
        <form className="link-create" onSubmit={submit}>
          <p className="kvx-section-label">Report a link</p>
          <label className="link-field">
            <span>Slug</span>
            <div className="link-prefix-input">
              <b>{ROOT_HOST}/</b>
              <input
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                required
              />
            </div>
          </label>
          <label className="link-field">
            <span>Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option value="PHISHING">Phishing</option>
              <option value="MALWARE">Malware</option>
              <option value="SPAM">Spam</option>
              <option value="ILLEGAL">Illegal content</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="link-field">
            <span>Details</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={1000}
            />
          </label>
          {state.message && (
            <p className={`link-form-status link-form-status-${state.status}`}>
              {state.message}
            </p>
          )}
          <button disabled={state.status === "loading"}>
            {state.status === "loading" ? "Sending..." : "Send report"}
          </button>
        </form>
      </main>
    </div>
  );
}
