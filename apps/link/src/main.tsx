import { FormEvent, StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import "./link.css";

interface Identity {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "USER";
}

interface LinkRecord {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  protected: boolean;
  expiresAt: string | null;
  disabledAt: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "ready"; identity: Identity; links: LinkRecord[] }
  | { status: "error"; message: string };

function App() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const refresh = async () => {
    try {
      const session = await request<{ identity: Identity }>("/api/session");
      const links = await request<{ data: LinkRecord[] }>("/api/links");
      setState({
        status: "ready",
        identity: session.identity,
        links: links.data,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setState({ status: "guest" });
        return;
      }
      setState({ status: "error", message: messageFrom(error) });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="link-app">
      <Header state={state} />
      <main>
        {state.status === "loading" && <Loading />}
        {state.status === "guest" && <Guest />}
        {state.status === "error" && (
          <Notice title="Link is unavailable" message={state.message} />
        )}
        {state.status === "ready" && (
          <Dashboard
            identity={state.identity}
            links={state.links}
            onRefresh={refresh}
          />
        )}
      </main>
    </div>
  );
}

function Header({ state }: { state: LoadState }) {
  return (
    <header className="link-header">
      <a className="link-brand" href="https://zarkiv.com">
        ZARKIV <span>LINK</span>
      </a>
      <nav aria-label="Product navigation">
        <a href="https://zarkiv.com">Products</a>
        <a href="https://pass.zarkiv.com">
          {state.status === "ready"
            ? state.identity.name || state.identity.email
            : "Account"}
        </a>
      </nav>
    </header>
  );
}

function Dashboard({
  identity,
  links,
  onRefresh,
}: {
  identity: Identity;
  links: LinkRecord[];
  onRefresh: () => Promise<void>;
}) {
  const totalClicks = useMemo(
    () => links.reduce((total, link) => total + link.clickCount, 0),
    [links],
  );

  return (
    <>
      <section className="link-hero">
        <div>
          <p className="link-kicker">Workspace / {identity.email}</p>
          <h1>Short links with a clear owner.</h1>
          <p className="link-lede">
            Create durable routes on zarkiv.com, then control access, expiry,
            and lightweight analytics from one place.
          </p>
        </div>
        <dl className="link-summary">
          <div>
            <dt>Active routes</dt>
            <dd>{links.filter((link) => !link.disabledAt).length}</dd>
          </div>
          <div>
            <dt>Total visits</dt>
            <dd>{totalClicks.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="link-workspace">
        <CreateLink onCreated={onRefresh} />
        <LinkList links={links} onRefresh={onRefresh} />
      </section>
    </>
  );
}

function CreateLink({ onCreated }: { onCreated: () => Promise<void> }) {
  const [targetUrl, setTargetUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [status, setStatus] = useState<{
    type: "idle" | "loading" | "error" | "success";
    message?: string;
  }>({ type: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ type: "loading" });
    try {
      const created = await request<{ shortUrl: string }>("/api/links", {
        method: "POST",
        body: JSON.stringify({
          targetUrl,
          slug: slug || undefined,
          password: password || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      setTargetUrl("");
      setSlug("");
      setPassword("");
      setExpiresAt("");
      setStatus({ type: "success", message: `${created.shortUrl} is live.` });
      await onCreated();
    } catch (error) {
      setStatus({ type: "error", message: messageFrom(error) });
    }
  };

  return (
    <form className="link-create" onSubmit={submit}>
      <div className="link-section-heading">
        <p className="link-kicker">New route</p>
        <h2>Point somewhere useful.</h2>
      </div>

      <label className="link-field link-field-wide">
        <span>Destination URL</span>
        <input
          type="url"
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          placeholder="https://example.com/launch"
          required
        />
      </label>

      <div className="link-field-grid">
        <label className="link-field">
          <span>Custom slug</span>
          <div className="link-prefix-input">
            <b>zarkiv.com/</b>
            <input
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              placeholder="optional"
              pattern="[a-z0-9][a-z0-9-]{1,49}"
            />
          </div>
        </label>
        <label className="link-field">
          <span>Expires</span>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>
      </div>

      <label className="link-field link-field-wide">
        <span>Password protection</span>
        <input
          type="password"
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Optional, at least 8 characters"
          autoComplete="new-password"
        />
      </label>

      <div className="link-form-footer">
        <p
          className={`link-form-status link-form-status-${status.type}`}
          role="status"
        >
          {status.message ?? "Routes become available immediately."}
        </p>
        <button type="submit" disabled={status.type === "loading"}>
          {status.type === "loading" ? "Creating..." : "Create link"}
        </button>
      </div>
    </form>
  );
}

function LinkList({
  links,
  onRefresh,
}: {
  links: LinkRecord[];
  onRefresh: () => Promise<void>;
}) {
  if (links.length === 0) {
    return (
      <section className="link-list link-empty">
        <p className="link-kicker">Routes</p>
        <h2>Your first short link will appear here.</h2>
      </section>
    );
  }

  return (
    <section className="link-list">
      <div className="link-section-heading">
        <p className="link-kicker">Routes / {links.length}</p>
        <h2>Owned destinations.</h2>
      </div>
      <div className="link-table" role="list">
        {links.map((link) => (
          <LinkRow key={link.id} link={link} onRefresh={onRefresh} />
        ))}
      </div>
    </section>
  );
}

function LinkRow({
  link,
  onRefresh,
}: {
  link: LinkRecord;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const expired = link.expiresAt
    ? Date.parse(link.expiresAt) <= Date.now()
    : false;
  const state = link.disabledAt ? "Paused" : expired ? "Expired" : "Live";

  const mutate = async (action: "toggle" | "delete") => {
    setBusy(true);
    try {
      await request(`/api/links/${encodeURIComponent(link.slug)}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        body:
          action === "toggle"
            ? JSON.stringify({ disabled: !link.disabledAt })
            : undefined,
      });
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="link-row" role="listitem">
      <div className="link-route">
        <a href={link.shortUrl} target="_blank" rel="noreferrer">
          /{link.slug}
        </a>
        <p title={link.targetUrl}>{link.targetUrl}</p>
      </div>
      <div className="link-tags">
        <span data-state={state.toLowerCase()}>{state}</span>
        {link.protected && <span>Protected</span>}
      </div>
      <div className="link-clicks">
        <strong>{link.clickCount.toLocaleString()}</strong>
        <span>visits</span>
      </div>
      <div className="link-actions">
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(link.shortUrl)}
        >
          Copy
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void mutate("toggle")}
        >
          {link.disabledAt ? "Resume" : "Pause"}
        </button>
        <button
          className="link-danger"
          type="button"
          disabled={busy}
          onClick={() => void mutate("delete")}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function Guest() {
  return (
    <Notice
      title="Sign in to manage routes."
      message="Zarkiv Pass keeps the account boundary separate from Link. After signing in, return here to create and manage zarkiv.com slugs."
    >
      <a className="link-primary" href="https://pass.zarkiv.com">
        Open Zarkiv Pass
      </a>
    </Notice>
  );
}

function Notice({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="link-notice">
      <p className="link-kicker">Zarkiv Link</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <section className="link-notice" aria-label="Loading Link">
      <p className="link-kicker">Zarkiv Link</p>
      <div className="link-loading" />
      <div className="link-loading link-loading-short" />
    </section>
  );
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as {
    message?: string;
  };
  if (!response.ok) {
    throw new ApiError(
      data.message ?? "The request could not be completed.",
      response.status,
    );
  }
  return data as T;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
