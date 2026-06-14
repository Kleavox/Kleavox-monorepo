import { FormEvent, useState } from "react";
import { ApiError, apiFetch as request, errorMessage } from "@kleavox/core";
import { AppFooter, ROOT_ORIGIN, challengeUrl, signInUrl } from "@kleavox/ui";

import {
  clearDraft,
  PUBLIC_LINK_DRAFT_KEY,
  readDraft,
  saveDraft,
} from "./drafts";
import { FilesApp } from "./files";
import type { FormState } from "./types";

export function Guest() {
  return (
    <>
      <section className="link-guest-hero">
        <div className="link-guest-intro">
          <p className="link-kicker">KLEAVOX LINK / PUBLIC</p>
          <h1>
            Send a URL.
            <br />
            Or the file itself.
          </h1>
          <p>One short address, with an ending when you need it.</p>
          <a className="link-primary" href={signInUrl()}>
            Sign in for controls
          </a>
        </div>
        <PublicLinkForm />
      </section>
      <section className="link-guest-files">
        <FilesApp embedded />
      </section>
      <GuestFooter />
    </>
  );
}

function GuestFooter() {
  return <AppFooter product="LINK" rootOrigin={ROOT_ORIGIN} />;
}

function PublicLinkForm() {
  const [targetUrl, setTargetUrl] = useState(
    () =>
      readDraft<{ targetUrl?: string }>(PUBLIC_LINK_DRAFT_KEY)?.targetUrl ?? "",
  );
  const [created, setCreated] = useState<string>();
  const [state, setState] = useState<FormState>({ status: "idle" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const result = await request<{ shortUrl: string }>("/api/public-links", {
        method: "POST",
        body: JSON.stringify({ targetUrl }),
      });
      clearDraft(PUBLIC_LINK_DRAFT_KEY);
      setCreated(result.shortUrl);
      setState({ status: "success", message: "Link ready." });
    } catch (error) {
      if (error instanceof ApiError && error.code === "CHALLENGE_FAILED") {
        saveDraft(PUBLIC_LINK_DRAFT_KEY, { targetUrl });
        window.location.assign(challengeUrl("basic"));
        return;
      }
      setState({ status: "error", message: errorMessage(error) });
    }
  }

  return (
    <form className="link-public-form" onSubmit={submit}>
      <div className="link-public-heading">
        <span>01</span>
        <div>
          <p className="link-kicker">ROUTE A URL</p>
          <h2>Paste the destination.</h2>
        </div>
      </div>
      <label className="link-field">
        <span>Destination</span>
        <input
          type="url"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          placeholder="https://example.com"
          required
        />
      </label>
      {created && (
        <div className="link-public-result">
          <a href={created} target="_blank" rel="noreferrer">
            {created}
          </a>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(created)}
          >
            Copy
          </button>
        </div>
      )}
      {state.message && (
        <p className={`link-form-status link-form-status-${state.status}`}>
          {state.message}
        </p>
      )}
      <button type="submit" disabled={state.status === "loading"}>
        {state.status === "loading" ? "Creating..." : "Shorten"}
      </button>
    </form>
  );
}
