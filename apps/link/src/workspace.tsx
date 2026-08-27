import { createPortal } from "react-dom";
import {
  type FormEvent,
  type KeyboardEvent,
  Suspense,
  lazy,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  apiFetch as request,
  displayHandle,
  errorMessage,
} from "@kleavox/core";
import type { Identity } from "@kleavox/core";
import {
  AppHeader,
  ErrorScreen,
  ROOT_HOST,
  ROOT_ORIGIN,
  StatusLine,
  loadNavCounts,
  loadOverview,
  plural,
  signInUrl,
  useAction,
  useDialog,
} from "@kleavox/ui";
import type { NavCounts } from "@kleavox/ui";

import { FilesApp } from "./files";
import type { AccountDrop } from "./files";
import { Guest } from "./guest";
import type {
  LinkRecord,
  LinkStats,
  LoadState,
  SessionResponse,
} from "./types";

const QrPanel = lazy(() => import("./QrPanel"));

const LINKS_PAGE_LIMIT = 50;

async function fetchAllLinks(): Promise<{
  data: LinkRecord[];
  total: number;
}> {
  const first = await request<{
    data: LinkRecord[];
    meta: { total: number; totalPages: number };
  }>(`/api/links?limit=${LINKS_PAGE_LIMIT}`);
  const data = [...first.data];
  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const next = await request<{ data: LinkRecord[] }>(
      `/api/links?limit=${LINKS_PAGE_LIMIT}&page=${page}`,
    );
    data.push(...next.data);
  }
  return { data, total: first.meta.total };
}

export function WorkspaceApp() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const refresh = async () => {
    try {
      const session = await request<SessionResponse>("/api/session");
      if (!session.authenticated || !session.identity) {
        setState({ status: "guest" });
        return;
      }
      const [links, files] = await Promise.all([
        fetchAllLinks(),
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
        linksTotal: links.total,
        files: files.drops,
      });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleLogout = async () => {
    try {
      await request("/api/logout", { method: "POST" });
    } catch (cause) {
      setState({ status: "error", message: errorMessage(cause) });
      return;
    }
    window.location.reload();
  };

  if (state.status === "error") {
    return <ErrorScreen code="503" message={state.message} />;
  }

  return (
    <div className="link-app">
      <Header state={state} onLogout={handleLogout} />
      <main className="kvx-main">
        {state.status === "loading" && <Loading />}
        {state.status === "guest" && <Guest />}
        {state.status === "ready" && (
          <Dashboard
            links={state.links}
            linksTotal={state.linksTotal}
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
  const [counts, setCounts] = useState<NavCounts | null>(null);

  useEffect(() => {
    void loadNavCounts().then(setCounts);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <AppHeader product="LINK" rootOrigin={ROOT_ORIGIN} counts={counts}>
      <nav className="kvx-nav" aria-label="Link tools">
        <a href="/report">Report</a>
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
              {displayHandle(state.identity.username, state.identity.email)}
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
    </AppHeader>
  );
}

function Dashboard({
  links,
  linksTotal,
  files,
  onRefresh,
}: {
  links: LinkRecord[];
  linksTotal: number;
  files: AccountDrop[];
  onRefresh: () => Promise<void>;
}) {
  const [reported, setReported] = useState<number | null>(null);

  useEffect(() => {
    void loadOverview().then((overview) =>
      setReported(overview?.link?.reported ?? null),
    );
  }, []);

  const summary = useMemo(() => {
    const now = Date.now();
    const expiring =
      links.filter(
        (link) =>
          !link.disabledAt &&
          link.expiresAt !== null &&
          isExpiringSoon(link.expiresAt, now),
      ).length +
      files.filter(
        (file) =>
          file.status === "ACTIVE" && isExpiringSoon(file.expiresAt, now),
      ).length;
    return {
      active: linksTotal,
      files: files.length,
      expiring,
      reported,
    };
  }, [links, files, linksTotal, reported]);

  return (
    <div className="kvx-shell-wide">
      <StatusLine
        model={{
          tool: "link",
          fields: [
            { value: String(summary.active), label: "active" },
            { value: String(summary.files), label: "files" },
            {
              value: String(summary.expiring),
              label: "expiring",
              attention: summary.expiring > 0,
            },
            {
              value:
                summary.reported === null ? "--" : String(summary.reported),
              label: "reported",
            },
          ],
        }}
      />

      <CreatePanel onCreated={onRefresh} />

      <LinkList links={links} files={files} onRefresh={onRefresh} />
    </div>
  );
}

const EXPIRING_WINDOW_MS = 6 * 60 * 60 * 1000;

function isExpiringSoon(expiresAt: string, now: number): boolean {
  const remaining = Date.parse(expiresAt) - now;
  return remaining > 0 && remaining <= EXPIRING_WINDOW_MS;
}

type CreateTab = "link" | "file";
const CREATE_TABS: CreateTab[] = ["link", "file"];

function CreatePanel({ onCreated }: { onCreated: () => Promise<void> }) {
  const uid = useId();
  const [tab, setTab] = useState<CreateTab>("link");
  const tabRefs = useRef<Record<CreateTab, HTMLButtonElement | null>>({
    link: null,
    file: null,
  });

  const focusTab = (target: CreateTab, delta: 1 | -1) => {
    const index = CREATE_TABS.indexOf(target);
    const next =
      CREATE_TABS[(index + delta + CREATE_TABS.length) % CREATE_TABS.length];
    if (!next) return;
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (
    current: CreateTab,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(current, 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(current, -1);
    }
  };

  return (
    <section className="link-compose">
      <p className="kvx-section-label">
        <span>Create</span>
        <b>{ROOT_HOST}/...</b>
      </p>
      <div
        className="link-tablist"
        role="tablist"
        aria-label="Create a handoff"
      >
        <button
          ref={(node) => {
            tabRefs.current.link = node;
          }}
          id={`${uid}-tab-link`}
          type="button"
          role="tab"
          className={tab === "link" ? "is-active" : undefined}
          aria-selected={tab === "link"}
          aria-controls={`${uid}-panel-link`}
          tabIndex={tab === "link" ? 0 : -1}
          onClick={() => setTab("link")}
          onKeyDown={(event) => onTabKeyDown("link", event)}
        >
          Short link
        </button>
        <button
          ref={(node) => {
            tabRefs.current.file = node;
          }}
          id={`${uid}-tab-file`}
          type="button"
          role="tab"
          className={tab === "file" ? "is-active" : undefined}
          aria-selected={tab === "file"}
          aria-controls={`${uid}-panel-file`}
          tabIndex={tab === "file" ? 0 : -1}
          onClick={() => setTab("file")}
          onKeyDown={(event) => onTabKeyDown("file", event)}
        >
          Send a file
        </button>
      </div>
      <div
        id={`${uid}-panel-link`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-link`}
        hidden={tab !== "link"}
      >
        <CreateLink onCreated={onCreated} />
      </div>
      <div
        id={`${uid}-panel-file`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-file`}
        hidden={tab !== "file"}
      >
        <FilesApp embedded onChanged={onCreated} />
      </div>
    </section>
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
      setStatus({ type: "error", message: errorMessage(error) });
    }
  };

  return (
    <form className="link-create" onSubmit={submit}>
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
              pattern="[a-z0-9][a-z0-9\-]{1,49}"
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
          createdAt: file.createdAt,
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
        <p className="kvx-section-label">Activity</p>
        <p className="link-empty-message">No handoffs yet.</p>
      </section>
    );
  }

  const start = (currentPage - 1) * LINKS_PER_PAGE;
  const pageItems = activity.slice(start, start + LINKS_PER_PAGE);

  return (
    <section className="link-list">
      <p className="kvx-section-label">
        <span>Activity</span>
        <b>
          {activity.length} {plural(activity.length, "item", "items")}
        </b>
      </p>
      <ul className="kvx-rows" role="list">
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
      </ul>
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
  const { error, run } = useAction();
  const publicUrl = `${ROOT_ORIGIN}/${file.publicToken}`;
  const state =
    file.status === "ACTIVE" && Date.parse(file.expiresAt) <= Date.now()
      ? "Expired"
      : file.status[0] + file.status.slice(1).toLowerCase();

  async function remove() {
    setBusy(true);
    try {
      await run(async () => {
        await request(`/api/public/${encodeURIComponent(file.publicToken)}`, {
          method: "DELETE",
        });
        await onRefresh();
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="link-activity-row">
      <div className="kvx-row">
        <span className={statePad(state)} aria-hidden="true" />
        <span className="kvx-row-state">{state}</span>
        <span className="kvx-row-title">
          <a href={publicUrl} target="_blank" rel="noreferrer">
            /{file.publicToken}
          </a>
          <small className="kvx-row-detail" title={file.name}>
            {file.name}
            {file.protected ? " · Protected" : ""}
          </small>
        </span>
        <span className="kvx-row-age">
          {file.downloadCount.toLocaleString()} downloads
        </span>
        <span className="kvx-row-tool">f/</span>
      </div>
      <div className="link-row-actions">
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
      {error && (
        <p
          className="link-form-status link-form-status-error link-row-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </li>
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
  const { error, run } = useAction();
  const expired = link.expiresAt
    ? Date.parse(link.expiresAt) <= Date.now()
    : false;
  const state = link.disabledAt ? "Paused" : expired ? "Expired" : "Live";

  const mutate = async (action: "toggle" | "delete") => {
    setBusy(true);
    try {
      await run(async () => {
        await request(`/api/links/${encodeURIComponent(link.slug)}`, {
          method: action === "delete" ? "DELETE" : "PATCH",
          body:
            action === "toggle"
              ? JSON.stringify({ disabled: !link.disabledAt })
              : undefined,
        });
        await onRefresh();
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="link-activity-row">
      <div className="kvx-row">
        <span className={statePad(state)} aria-hidden="true" />
        <span className="kvx-row-state">{state}</span>
        <span className="kvx-row-title">
          <a href={link.shortUrl} target="_blank" rel="noreferrer">
            /{link.slug}
          </a>
          <small className="kvx-row-detail" title={link.targetUrl}>
            {link.targetUrl}
            {link.protected ? " · Protected" : ""}
          </small>
        </span>
        <span className="kvx-row-age">
          {link.clickCount.toLocaleString()} visits
        </span>
        <span className="kvx-row-tool">{"→"}</span>
      </div>
      <div className="link-row-actions">
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
      {error && (
        <p
          className="link-form-status link-form-status-error link-row-error"
          role="alert"
        >
          {error}
        </p>
      )}
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
      {showQr && (
        <Suspense fallback={null}>
          <QrPanel link={link} onClose={() => setShowQr(false)} />
        </Suspense>
      )}
    </li>
  );
}

function statePad(word: string): string {
  if (word === "Live" || word === "Active") return "kvx-pad kvx-pad-ok";
  if (word === "Paused") return "kvx-pad kvx-pad-warn";
  if (word === "Exhausted" || word === "Failed")
    return "kvx-pad kvx-pad-danger";
  return "kvx-pad";
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
  const titleId = useId();
  const dialogRef = useDialog<HTMLFormElement>(onClose);
  const [targetUrl, setTargetUrl] = useState(link.targetUrl);
  const [expiresAt, setExpiresAt] = useState(
    link.expiresAt ? link.expiresAt.slice(0, 16) : "",
  );
  const [password, setPassword] = useState("");
  const [clearPassword, setClearPassword] = useState(false);
  const [state, setState] = useState<{
    status: "idle" | "loading" | "error" | "success";
    message?: string;
  }>({ status: "idle" });

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
      setState({ status: "error", message: errorMessage(error) });
    }
  };

  return createPortal(
    <div className="link-modal-backdrop" role="presentation">
      <form
        ref={dialogRef}
        tabIndex={-1}
        className="link-stats link-edit"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
      >
        <header>
          <div>
            <p className="link-kicker">EDIT / {link.slug}</p>
            <h2 id={titleId}>Route settings</h2>
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
    </div>,
    document.body,
  );
}

function StatsPanel({
  link,
  onClose,
}: {
  link: LinkRecord;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialogRef = useDialog<HTMLElement>(onClose);
  const [stats, setStats] = useState<LinkStats>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    void request<LinkStats>(`/api/links/${encodeURIComponent(link.slug)}/stats`)
      .then(setStats)
      .catch((cause) => setError(errorMessage(cause)));
  }, [link.slug]);

  const maxDaily = Math.max(
    1,
    ...(stats?.daily.map((item) => item.value) ?? []),
  );

  return createPortal(
    <div className="link-modal-backdrop" role="presentation">
      <section
        ref={dialogRef}
        tabIndex={-1}
        className="link-stats"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header>
          <div>
            <p className="link-kicker">ANALYTICS / {link.slug}</p>
            <h2 id={titleId}>{stats?.total ?? link.clickCount} clicks</h2>
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
    </div>,
    document.body,
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

function Loading() {
  return (
    <section className="link-notice" aria-label="Loading Link">
      <p className="link-kicker">Kleavox Link</p>
      <div className="link-loading" />
      <div className="link-loading link-loading-short" />
    </section>
  );
}

function isIdentity(value: unknown): value is Identity {
  if (!value || typeof value !== "object") return false;
  const identity = value as Partial<Identity>;
  return (
    typeof identity.id === "string" &&
    typeof identity.email === "string" &&
    (typeof identity.username === "string" || identity.username === null) &&
    (identity.role === "ADMIN" || identity.role === "USER")
  );
}
