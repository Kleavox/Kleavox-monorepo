import { FormEvent, StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { QRCodeSVG } from "qrcode.react";
import type { Identity } from "@kleavox/core";

import "@kleavox/ui/styles.css";
import { ROOT_HOST, ROOT_ORIGIN, signInUrl } from "./config";
import { FilesApp } from "./files";
import type { AccountDrop } from "./files";
import "./link.css";

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

interface SessionResponse {
  authenticated: boolean;
  identity?: Identity;
}

interface LinkStats {
  total: number;
  lastClickedAt: string | null;
  daily: Array<{ date: string; value: number }>;
  browsers: Array<{ name: string; value: number }>;
  countries: Array<{ name: string; value: number }>;
  referrers: Array<{ name: string; value: number }>;
}

type LoadState =
  | { status: "loading" }
  | { status: "guest" }
  | {
      status: "ready";
      identity: Identity;
      links: LinkRecord[];
      files: AccountDrop[];
    }
  | { status: "error"; message: string };

function App() {
  if (
    window.location.pathname.startsWith("/d/") ||
    /^\/f_[a-zA-Z0-9_-]+$/u.test(window.location.pathname)
  ) {
    return <FilesApp />;
  }
  if (window.location.pathname === "/report") {
    return <ReportApp />;
  }

  return <WorkspaceApp />;
}

function WorkspaceApp() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const refresh = async () => {
    try {
      const session = await request<SessionResponse>("/api/session");
      if (!session.authenticated || !session.identity) {
        setState({ status: "guest" });
        return;
      }
      const [links, files] = await Promise.all([
        request<{ data: LinkRecord[] }>("/api/links"),
        request<{ drops: AccountDrop[] }>("/api/drops"),
      ]);
      if (
        !isIdentity(session.identity) ||
        !Array.isArray(links.data) ||
        !Array.isArray(files.drops)
      ) {
        throw new Error("Link received an invalid response from its API.");
      }
      setState({
        status: "ready",
        identity: session.identity,
        links: links.data,
        files: files.drops,
      });
    } catch (error) {
      setState({ status: "error", message: messageFrom(error) });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleLogout = async () => {
    try {
      await request("/api/logout", { method: "POST" });
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className="link-app">
      <Header state={state} onLogout={handleLogout} />
      <main className="kvx-main">
        {state.status === "loading" && <Loading />}
        {state.status === "guest" && <Guest />}
        {state.status === "error" && (
          <Notice title="Link is unavailable" message={state.message} />
        )}
        {state.status === "ready" && (
          <Dashboard
            identity={state.identity}
            links={state.links}
            files={state.files}
            onRefresh={refresh}
          />
        )}
      </main>
    </div>
  );
}

function Header({
  state,
  onLogout,
}: {
  state: LoadState;
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header className="kvx-header">
      <a className="kvx-brand" href={ROOT_ORIGIN}>
        KLEAV<span>OX</span> <span className="kvx-brand-app">/ LINK</span>
      </a>
      <nav className="kvx-nav" aria-label="Product navigation">
        <a className="is-active" href="/">
          Create
        </a>
        <a href="/report">Report</a>
        <a href={ROOT_ORIGIN}>System</a>
        {state.status === "ready" ? (
          <div className="link-account">
            <button
              type="button"
              className="link-account-trigger"
              aria-expanded={menuOpen}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => !open);
              }}
            >
              {state.identity.name || state.identity.email}
            </button>
            {menuOpen && (
              <div
                className="link-account-menu"
                onClick={(event) => event.stopPropagation()}
              >
                <button type="button" onClick={onLogout}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <a href={signInUrl()}>Account</a>
        )}
      </nav>
    </header>
  );
}

function Dashboard({
  identity,
  links,
  files,
  onRefresh,
}: {
  identity: Identity;
  links: LinkRecord[];
  files: AccountDrop[];
  onRefresh: () => Promise<void>;
}) {
  const totalClicks = useMemo(
    () => links.reduce((total, link) => total + link.clickCount, 0),
    [links],
  );

  return (
    <div className="kvx-shell-wide">
      <section className="link-hero">
        <div>
          <p className="kvx-kicker">LINK / {identity.email}</p>
          <h1 className="kvx-title">
            One address.
            <br />
            Any handoff.
          </h1>
          <p className="kvx-lede">
            Route a destination or send a temporary file from the same
            workspace.
          </p>
        </div>
        <dl className="link-summary">
          <div>
            <dt>Active handoffs</dt>
            <dd>
              {links.filter((link) => !link.disabledAt).length +
                files.filter((file) => file.status === "ACTIVE").length}
            </dd>
          </div>
          <div>
            <dt>Route visits</dt>
            <dd>{totalClicks.toLocaleString()}</dd>
          </div>
        </dl>
      </section>

      <section className="link-compose">
        <header className="link-compose-heading">
          <p className="kvx-kicker">CREATE / ONE PUBLIC NAMESPACE</p>
          <h2>What are you sending?</h2>
          <p>
            URLs and files both leave as <strong>{ROOT_HOST}/...</strong>
          </p>
        </header>
        <div className="link-compose-grid">
          <CreateLink onCreated={onRefresh} />
          <FilesApp embedded onChanged={onRefresh} />
        </div>
      </section>

      <LinkList links={links} files={files} onRefresh={onRefresh} />
    </div>
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
        <span className="link-create-index">01</span>
        <div>
          <p className="link-kicker">ROUTE A URL</p>
          <h2>Short link</h2>
        </div>
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
            <b>{ROOT_HOST}/</b>
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
          {status.message ?? "Ready."}
        </p>
        <button type="submit" disabled={status.type === "loading"}>
          {status.type === "loading" ? "Creating..." : "Create link"}
        </button>
      </div>
    </form>
  );
}

const LINKS_PER_PAGE = 8;

function LinkList({
  links,
  files,
  onRefresh,
}: {
  links: LinkRecord[];
  files: AccountDrop[];
  onRefresh: () => Promise<void>;
}) {
  const activity = useMemo(
    () =>
      [
        ...links.map((link) => ({
          kind: "link" as const,
          createdAt: link.createdAt,
          value: link,
        })),
        ...files.map((file) => ({
          kind: "file" as const,
          createdAt: file.created_at,
          value: file,
        })),
      ].sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt),
      ),
    [links, files],
  );

  const pageCount = Math.max(1, Math.ceil(activity.length / LINKS_PER_PAGE));
  const [page, setPage] = useState(1);
  const currentPage = Math.min(page, pageCount);

  useEffect(() => {
    setPage(1);
  }, [activity.length]);

  if (activity.length === 0) {
    return (
      <section className="link-list link-empty">
        <p className="link-kicker">ACTIVITY</p>
        <h2>No handoffs yet.</h2>
      </section>
    );
  }

  const start = (currentPage - 1) * LINKS_PER_PAGE;
  const pageItems = activity.slice(start, start + LINKS_PER_PAGE);

  return (
    <section className="link-list">
      <div className="link-section-heading">
        <p className="link-kicker">ACTIVITY / {activity.length}</p>
        <h2>Links and files</h2>
      </div>
      <div className="link-table" role="list">
        {pageItems.map((item) =>
          item.kind === "link" ? (
            <LinkRow
              key={`link-${item.value.id}`}
              link={item.value}
              onRefresh={onRefresh}
            />
          ) : (
            <FileRow
              key={`file-${item.value.id}`}
              file={item.value}
              onRefresh={onRefresh}
            />
          ),
        )}
      </div>
      {pageCount > 1 && (
        <nav className="link-pagination" aria-label="Activity pages">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Prev
          </button>
          <span>
            Page {currentPage} / {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

function FileRow({
  file,
  onRefresh,
}: {
  file: AccountDrop;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const publicUrl = `${ROOT_ORIGIN}/${file.public_token}`;
  const state =
    file.status === "ACTIVE" && Date.parse(file.expires_at) <= Date.now()
      ? "Expired"
      : file.status[0] + file.status.slice(1).toLowerCase();

  async function remove() {
    setBusy(true);
    try {
      await request(`/api/public/${encodeURIComponent(file.public_token)}`, {
        method: "DELETE",
      });
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="link-row link-file-row" role="listitem">
      <div className="link-route">
        <a href={publicUrl} target="_blank" rel="noreferrer">
          /{file.public_token}
        </a>
        <p title={file.original_name}>{file.original_name}</p>
      </div>
      <div className="link-tags">
        <span data-state={state.toLowerCase()}>{state}</span>
        <span className="link-tag-file">File</span>
        {Boolean(file.protected) && <span>Protected</span>}
      </div>
      <div className="link-clicks">
        <strong>{file.download_count.toLocaleString()}</strong>
        <span>downloads</span>
      </div>
      <div className="link-actions">
        <button
          type="button"
          onClick={() => void navigator.clipboard.writeText(publicUrl)}
        >
          Copy
        </button>
        {!["DELETED", "FAILED"].includes(file.status) && (
          <button
            className="link-danger"
            type="button"
            disabled={busy}
            onClick={() => void remove()}
          >
            Delete
          </button>
        )}
      </div>
    </article>
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
  const [showStats, setShowStats] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showQr, setShowQr] = useState(false);
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
        <button type="button" onClick={() => setShowStats(true)}>
          Stats
        </button>
        <button type="button" onClick={() => setShowQr(true)}>
          QR
        </button>
        <button type="button" onClick={() => setShowEdit(true)}>
          Edit
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
      {showStats && (
        <StatsPanel link={link} onClose={() => setShowStats(false)} />
      )}
      {showEdit && (
        <EditPanel
          link={link}
          onClose={() => setShowEdit(false)}
          onSaved={onRefresh}
        />
      )}
      {showQr && <QrPanel link={link} onClose={() => setShowQr(false)} />}
    </article>
  );
}

function Guest() {
  return (
    <>
      <section className="link-guest">
        <div className="link-guest-copy">
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
      <section className="link-guest-drop">
        <FilesApp embedded />
      </section>
    </>
  );
}

function PublicLinkForm() {
  const [targetUrl, setTargetUrl] = useState("");
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
      setCreated(result.shortUrl);
      setState({ status: "success", message: "Link ready." });
    } catch (error) {
      setState({ status: "error", message: messageFrom(error) });
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

interface FormState {
  status: "idle" | "loading" | "error" | "success";
  message?: string;
}

function EditPanel({
  link,
  onClose,
  onSaved,
}: {
  link: LinkRecord;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [targetUrl, setTargetUrl] = useState(link.targetUrl);
  const [expiresAt, setExpiresAt] = useState(
    link.expiresAt ? link.expiresAt.slice(0, 16) : "",
  );
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [state, setState] = useState<FormState>({ status: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      await request(`/api/links/${encodeURIComponent(link.slug)}`, {
        method: "PATCH",
        body: JSON.stringify({
          targetUrl,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          password: clearPassword ? null : password || undefined,
        }),
      });
      await onSaved();
      onClose();
    } catch (error) {
      setState({ status: "error", message: messageFrom(error) });
    }
  };

  return (
    <div className="link-modal-backdrop" role="presentation">
      <form className="link-stats link-edit" onSubmit={submit}>
        <header>
          <div>
            <p className="link-kicker">EDIT / {link.slug}</p>
            <h2>Route settings</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <label className="link-field">
          <span>Destination</span>
          <input
            type="url"
            value={targetUrl}
            onChange={(event) => setTargetUrl(event.target.value)}
            required
          />
        </label>
        <label className="link-field">
          <span>Expires</span>
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </label>
        <label className="link-field">
          <span>New password</span>
          <input
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={clearPassword}
            placeholder={link.protected ? "Keep current password" : "Optional"}
          />
        </label>
        {link.protected && (
          <label className="link-check">
            <input
              type="checkbox"
              checked={clearPassword}
              onChange={(event) => setClearPassword(event.target.checked)}
            />
            Remove password
          </label>
        )}
        {state.message && (
          <p className="link-form-status link-form-status-error">
            {state.message}
          </p>
        )}
        <button className="link-primary" disabled={state.status === "loading"}>
          {state.status === "loading" ? "Saving..." : "Save"}
        </button>
      </form>
    </div>
  );
}

function QrPanel({ link, onClose }: { link: LinkRecord; onClose: () => void }) {
  const download = () => {
    const svg = document.querySelector<SVGElement>("#link-qr-code");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml",
    });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${link.slug}.svg`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  return (
    <div className="link-modal-backdrop" role="presentation">
      <section className="link-stats link-qr" role="dialog" aria-modal="true">
        <header>
          <div>
            <p className="link-kicker">QR / {link.slug}</p>
            <h2>Scan route</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div>
          <QRCodeSVG
            id="link-qr-code"
            value={link.shortUrl}
            size={256}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
          />
        </div>
        <button className="link-primary" onClick={download}>
          Download SVG
        </button>
      </section>
    </div>
  );
}

function ReportApp() {
  const [slug, setSlug] = useState("");
  const [reason, setReason] = useState("PHISHING");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      await request("/api/reports", {
        method: "POST",
        body: JSON.stringify({ slug, reason, details: details || undefined }),
      });
      setSlug("");
      setDetails("");
      setState({ status: "success", message: "Report received." });
    } catch (error) {
      setState({ status: "error", message: messageFrom(error) });
    }
  };

  return (
    <div className="link-app">
      <header className="link-header">
        <a className="link-brand" href="/">
          KLEAV<span>OX</span> <span className="kvx-brand-app">/ LINK</span>
        </a>
        <nav>
          <a href="/">Create</a>
        </nav>
      </header>
      <main className="link-report-page">
        <form className="link-create" onSubmit={submit}>
          <div className="link-section-heading">
            <p className="link-kicker">SAFETY</p>
            <h1>Report a link</h1>
          </div>
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

function StatsPanel({
  link,
  onClose,
}: {
  link: LinkRecord;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<LinkStats>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void request<LinkStats>(`/api/links/${encodeURIComponent(link.slug)}/stats`)
      .then(setStats)
      .catch((cause) => setError(messageFrom(cause)));
  }, [link.slug]);

  const maxDaily = Math.max(
    1,
    ...(stats?.daily.map((item) => item.value) ?? []),
  );

  return (
    <div className="link-modal-backdrop" role="presentation">
      <section className="link-stats" role="dialog" aria-modal="true">
        <header>
          <div>
            <p className="link-kicker">ANALYTICS / {link.slug}</p>
            <h2>{stats?.total ?? link.clickCount} clicks</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        {error && (
          <p className="link-form-status link-form-status-error">{error}</p>
        )}
        {!stats && !error && <div className="link-loading" />}
        {stats && (
          <>
            <div className="link-chart" aria-label="Clicks over seven days">
              {stats.daily.map((item) => (
                <div key={item.date}>
                  <i
                    style={{
                      height: `${Math.max(4, (item.value / maxDaily) * 100)}%`,
                    }}
                  />
                  <span>{item.date.slice(5)}</span>
                </div>
              ))}
            </div>
            <div className="link-dimensions">
              <Dimension title="Browsers" values={stats.browsers} />
              <Dimension title="Countries" values={stats.countries} />
              <Dimension title="Referrers" values={stats.referrers} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Dimension({
  title,
  values,
}: {
  title: string;
  values: Array<{ name: string; value: number }>;
}) {
  return (
    <div>
      <strong>{title}</strong>
      {values.length === 0 ? (
        <p>No data</p>
      ) : (
        values.map((item) => (
          <p key={item.name}>
            <span>{item.name}</span>
            <b>{item.value}</b>
          </p>
        ))
      )}
    </div>
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
      <p className="link-kicker">Kleavox Link</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {children}
    </section>
  );
}

function Loading() {
  return (
    <section className="link-notice" aria-label="Loading Link">
      <p className="link-kicker">Kleavox Link</p>
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
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  let data: { message?: string };
  try {
    data = (await response.json()) as { message?: string };
  } catch {
    throw new ApiError(
      "Link received an invalid response from its API.",
      response.status,
    );
  }
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

function isIdentity(value: unknown): value is Identity {
  if (!value || typeof value !== "object") return false;
  const identity = value as Partial<Identity>;
  return (
    typeof identity.id === "string" &&
    typeof identity.email === "string" &&
    (typeof identity.name === "string" || identity.name === null) &&
    (identity.role === "ADMIN" || identity.role === "USER")
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
