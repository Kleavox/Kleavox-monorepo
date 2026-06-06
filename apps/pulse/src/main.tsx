import { FormEvent, StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import "@zarkiv/ui/styles.css";
import "./pulse.css";

interface Identity {
  id: string;
  email: string;
  name: string | null;
}

interface SessionResponse {
  authenticated: boolean;
  identity?: Identity;
}

interface NodeRecord {
  id: string;
  name: string;
  hostname: string | null;
  architecture: string | null;
  operating_system: string | null;
  agent_version: string | null;
  last_seen_at: string | null;
  enrolled_at: string | null;
  interval_seconds: number;
  cpu_percent: number | null;
  memory_used_bytes: number | null;
  memory_total_bytes: number | null;
  disk_used_bytes: number | null;
  disk_total_bytes: number | null;
  load_1: number | null;
  uptime_seconds: number | null;
}

interface CheckRecord {
  id: string;
  node_id: string;
  name: string;
  kind: "HTTP" | "TCP" | "SERVICE";
  target: string;
  enabled: number;
  status: "UNKNOWN" | "UP" | "DOWN";
  latency_ms: number | null;
  last_checked_at: string | null;
  consecutive_failures: number;
  last_message: string | null;
}

interface Incident {
  id: string;
  status: "OPEN" | "RESOLVED";
  started_at: string;
  resolved_at: string | null;
  summary: string | null;
  check_name: string;
  node_name: string;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  url: string | null;
}

interface Note {
  id: string;
  project_id: string | null;
  content: string;
  pinned: number;
}

interface Overview {
  nodes: NodeRecord[];
  checks: CheckRecord[];
  incidents: Incident[];
  projects: Project[];
  notes: Note[];
}

type AppState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "error"; message: string }
  | { status: "ready"; identity: Identity; overview: Overview };

interface Enrollment {
  id?: string;
  enrollmentToken: string;
  enrollmentExpiresAt: string;
  command: string;
}

function App() {
  const [state, setState] = useState<AppState>({ status: "loading" });
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);

  const refresh = async () => {
    try {
      const session = await api<SessionResponse>("/api/session");
      if (!session.authenticated || !session.identity) {
        setState({ status: "guest" });
        return;
      }
      const overview = await api<Overview>("/api/overview");
      setState({ status: "ready", identity: session.identity, overview });
    } catch (error) {
      setState({ status: "error", message: errorMessage(error) });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="pulse-app">
      <Header state={state} />
      {state.status === "loading" && <Loading />}
      {state.status === "guest" && <Guest />}
      {state.status === "error" && (
        <Empty title="Pulse is unavailable" message={state.message} />
      )}
      {state.status === "ready" && (
        <Dashboard
          identity={state.identity}
          overview={state.overview}
          onRefresh={refresh}
          onEnrollment={setEnrollment}
        />
      )}
      {enrollment && (
        <EnrollmentDialog
          enrollment={enrollment}
          onClose={() => setEnrollment(null)}
        />
      )}
    </div>
  );
}

function Header({ state }: { state: AppState }) {
  return (
    <header className="pulse-header">
      <a href="https://zarkiv.com" className="pulse-brand">
        ZARKIV <span>PULSE</span>
      </a>
      <div className="pulse-header-status">
        <span className="pulse-signal" />
        {state.status === "ready" ? "Online" : "Monitor"}
      </div>
      <a href="https://pass.zarkiv.com" className="pulse-account">
        {state.status === "ready"
          ? state.identity.name || state.identity.email
          : "Account"}
      </a>
    </header>
  );
}

function Dashboard({
  identity,
  overview,
  onRefresh,
  onEnrollment,
}: {
  identity: Identity;
  overview: Overview;
  onRefresh: () => Promise<void>;
  onEnrollment: (value: Enrollment) => void;
}) {
  const nodeStates = useMemo(
    () => overview.nodes.map((node) => ({ node, state: nodeState(node) })),
    [overview.nodes],
  );
  const online = nodeStates.filter(({ state }) => state === "online").length;
  const openIncidents = overview.incidents.filter(
    (incident) => incident.status === "OPEN",
  ).length;
  const downChecks = overview.checks.filter(
    (check) => check.enabled && check.status === "DOWN",
  ).length;

  return (
    <main className="pulse-main">
      <section className="pulse-command">
        <div>
          <p className="pulse-kicker">Workspace / {identity.email}</p>
          <h1>See every host.</h1>
          <p>Metrics, checks, incidents, projects, and notes.</p>
        </div>
        <div className="pulse-command-actions">
          <CreateNode onCreated={onEnrollment} onRefresh={onRefresh} />
        </div>
      </section>

      <section className="pulse-strip" aria-label="Pulse summary">
        <Metric
          label="Nodes online"
          value={`${online}/${overview.nodes.length}`}
        />
        <Metric
          label="Checks down"
          value={String(downChecks)}
          danger={downChecks > 0}
        />
        <Metric
          label="Open incidents"
          value={String(openIncidents)}
          danger={openIncidents > 0}
        />
        <Metric
          label="Active projects"
          value={String(
            overview.projects.filter((project) => project.status === "ACTIVE")
              .length,
          )}
        />
      </section>

      <div className="pulse-grid">
        <section className="pulse-nodes">
          <SectionTitle eyebrow="Fleet" title="Monitored nodes" />
          {overview.nodes.length === 0 ? (
            <InlineEmpty message="Create a node to generate a one-time enrollment command." />
          ) : (
            <div className="pulse-node-list">
              {nodeStates.map(({ node, state }) => (
                <NodePanel
                  key={node.id}
                  node={node}
                  state={state}
                  checks={overview.checks.filter(
                    (check) => check.node_id === node.id,
                  )}
                  onRefresh={onRefresh}
                  onEnrollment={onEnrollment}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="pulse-side">
          <IncidentList incidents={overview.incidents} />
          <ProjectNotes
            projects={overview.projects}
            notes={overview.notes}
            onRefresh={onRefresh}
          />
        </aside>
      </div>
    </main>
  );
}

function CreateNode({
  onCreated,
  onRefresh,
}: {
  onCreated: (value: Enrollment) => void;
  onRefresh: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<Enrollment>("/api/nodes", {
        method: "POST",
        body: JSON.stringify({ name, intervalSeconds: 60 }),
      });
      setName("");
      setOpen(false);
      onCreated(result);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button className="pulse-primary" onClick={() => setOpen(true)}>
        Enroll node
      </button>
    );
  }

  return (
    <form className="pulse-inline-form" onSubmit={submit}>
      <label>
        <span>Node label</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="production-01"
          autoFocus
          required
        />
      </label>
      <div>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="pulse-primary" disabled={busy}>
          {busy ? "Creating..." : "Create token"}
        </button>
      </div>
    </form>
  );
}

function NodePanel({
  node,
  state,
  checks,
  onRefresh,
  onEnrollment,
}: {
  node: NodeRecord;
  state: "pending" | "online" | "offline";
  checks: CheckRecord[];
  onRefresh: () => Promise<void>;
  onEnrollment: (value: Enrollment) => void;
}) {
  const memory = percentage(node.memory_used_bytes, node.memory_total_bytes);
  const disk = percentage(node.disk_used_bytes, node.disk_total_bytes);

  const renewEnrollment = async () => {
    const result = await api<Enrollment>(`/api/nodes/${node.id}/enrollment`, {
      method: "POST",
    });
    onEnrollment(result);
  };

  return (
    <article className="pulse-node">
      <header>
        <div>
          <span className={`pulse-state pulse-state-${state}`}>{state}</span>
          <h3>{node.name}</h3>
          <p>
            {[
              node.hostname,
              node.operating_system,
              node.architecture,
              node.agent_version,
            ]
              .filter(Boolean)
              .join(" / ") || "Awaiting agent enrollment"}
          </p>
        </div>
        <div className="pulse-node-time">
          <span>Last signal</span>
          <strong>{relativeTime(node.last_seen_at)}</strong>
        </div>
      </header>

      <div className="pulse-resources">
        <Resource label="CPU" value={node.cpu_percent} suffix="%" />
        <Resource label="Memory" value={memory} suffix="%" />
        <Resource label="Disk" value={disk} suffix="%" />
        <Resource label="Load" value={node.load_1} />
      </div>

      <div className="pulse-checks">
        <div className="pulse-check-heading">
          <strong>Checks</strong>
          <CreateCheck nodeId={node.id} onRefresh={onRefresh} />
        </div>
        {checks.length === 0 ? (
          <p className="pulse-muted">No checks assigned.</p>
        ) : (
          checks.map((check) => (
            <div className="pulse-check" key={check.id}>
              <span
                className={`pulse-dot pulse-dot-${check.status.toLowerCase()}`}
              />
              <div>
                <strong>{check.name}</strong>
                <p>
                  {check.kind} / {check.target}
                </p>
              </div>
              <span className="pulse-check-status">{check.status}</span>
              <span>
                {check.latency_ms === null ? "--" : `${check.latency_ms} ms`}
              </span>
              <button
                onClick={async () => {
                  await api(`/api/checks/${check.id}`, { method: "DELETE" });
                  await onRefresh();
                }}
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {state === "pending" && (
        <button
          className="pulse-text-action"
          onClick={() => void renewEnrollment()}
        >
          Generate a new enrollment token
        </button>
      )}
    </article>
  );
}

function CreateCheck({
  nodeId,
  onRefresh,
}: {
  nodeId: string;
  onRefresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"HTTP" | "TCP" | "SERVICE">("HTTP");
  const [target, setTarget] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await api("/api/checks", {
      method: "POST",
      body: JSON.stringify({ nodeId, name, kind, target, timeoutSeconds: 10 }),
    });
    setName("");
    setTarget("");
    setOpen(false);
    await onRefresh();
  };

  if (!open) {
    return <button onClick={() => setOpen(true)}>Add check</button>;
  }

  return (
    <form className="pulse-check-form" onSubmit={submit}>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Public API"
        aria-label="Check name"
        required
      />
      <select
        value={kind}
        onChange={(event) =>
          setKind(event.target.value as "HTTP" | "TCP" | "SERVICE")
        }
        aria-label="Check kind"
      >
        <option value="HTTP">HTTP</option>
        <option value="TCP">TCP</option>
        <option value="SERVICE">Systemd</option>
      </select>
      <input
        value={target}
        onChange={(event) => setTarget(event.target.value)}
        placeholder={
          kind === "HTTP"
            ? "https://example.com/health"
            : kind === "TCP"
              ? "127.0.0.1:5432"
              : "nginx.service"
        }
        aria-label="Check target"
        required
      />
      <button>Save</button>
      <button type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </form>
  );
}

function IncidentList({ incidents }: { incidents: Incident[] }) {
  return (
    <section className="pulse-incidents">
      <SectionTitle eyebrow="Events" title="Incident log" />
      {incidents.length === 0 ? (
        <InlineEmpty message="No incidents have been recorded." />
      ) : (
        <div>
          {incidents.slice(0, 8).map((incident) => (
            <article key={incident.id}>
              <span
                className={`pulse-event pulse-event-${incident.status.toLowerCase()}`}
              />
              <div>
                <strong>{incident.check_name}</strong>
                <p>
                  {incident.summary || `${incident.node_name} changed state.`}
                </p>
                <time>
                  {incident.status} / {relativeTime(incident.started_at)}
                </time>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectNotes({
  projects,
  notes,
  onRefresh,
}: {
  projects: Project[];
  notes: Note[];
  onRefresh: () => Promise<void>;
}) {
  const [projectName, setProjectName] = useState("");
  const [note, setNote] = useState("");

  return (
    <section className="pulse-projects">
      <SectionTitle eyebrow="Context" title="Projects and notes" />
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await api("/api/projects", {
            method: "POST",
            body: JSON.stringify({ name: projectName }),
          });
          setProjectName("");
          await onRefresh();
        }}
      >
        <input
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="New project"
          aria-label="New project"
          required
        />
        <button>Add</button>
      </form>
      <div className="pulse-project-list">
        {projects.map((project) => (
          <article key={project.id}>
            <select
              value={project.status}
              aria-label={`${project.name} status`}
              onChange={async (event) => {
                await api(`/api/projects/${project.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ status: event.target.value }),
                });
                await onRefresh();
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <strong>{project.name}</strong>
            <button
              aria-label={`Delete ${project.name}`}
              onClick={async () => {
                await api(`/api/projects/${project.id}`, { method: "DELETE" });
                await onRefresh();
              }}
            >
              Remove
            </button>
          </article>
        ))}
      </div>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await api("/api/notes", {
            method: "POST",
            body: JSON.stringify({ content: note, pinned: false }),
          });
          setNote("");
          await onRefresh();
        }}
      >
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Operational note"
          aria-label="Operational note"
          required
        />
        <button>Add</button>
      </form>
      <div className="pulse-note-list">
        {notes.slice(0, 5).map((item) => (
          <article key={item.id}>
            <p>{item.content}</p>
            <div>
              <button
                onClick={async () => {
                  await api(`/api/notes/${item.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ pinned: !item.pinned }),
                  });
                  await onRefresh();
                }}
              >
                {item.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={async () => {
                  await api(`/api/notes/${item.id}`, { method: "DELETE" });
                  await onRefresh();
                }}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EnrollmentDialog({
  enrollment,
  onClose,
}: {
  enrollment: Enrollment;
  onClose: () => void;
}) {
  return (
    <div className="pulse-dialog-backdrop" role="presentation">
      <section className="pulse-dialog" role="dialog" aria-modal="true">
        <p className="pulse-kicker">One-time enrollment</p>
        <h2>Connect this VPS.</h2>
        <p>The token expires in 30 minutes.</p>
        <pre>{enrollment.command}</pre>
        <div>
          <button
            onClick={() =>
              void navigator.clipboard.writeText(enrollment.command)
            }
          >
            Copy command
          </button>
          <button className="pulse-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong className={danger ? "pulse-danger" : ""}>{value}</strong>
    </div>
  );
}

function Resource({
  label,
  value,
  suffix = "",
}: {
  label: string;
  value: number | null;
  suffix?: string;
}) {
  const normalized = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <span>{label}</span>
      <strong>
        {value === null
          ? "--"
          : `${value.toFixed(value >= 10 ? 0 : 1)}${suffix}`}
      </strong>
      <i style={{ "--resource": `${normalized}%` } as React.CSSProperties} />
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="pulse-section-title">
      <p className="pulse-kicker">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  );
}

function InlineEmpty({ message }: { message: string }) {
  return <p className="pulse-inline-empty">{message}</p>;
}

function Guest() {
  return (
    <main className="pulse-guest">
      <section>
        <p className="pulse-kicker">Zarkiv Pulse / Go agent</p>
        <h1>
          Your VPS,
          <br />
          in one signal.
        </h1>
        <p>Host metrics. Service checks. Incident history.</p>
        <a
          className="pulse-primary"
          href={`https://pass.zarkiv.com?returnTo=${encodeURIComponent(window.location.href)}`}
        >
          Sign in
        </a>
      </section>
      <div className="pulse-guest-panel" aria-hidden="true">
        <header>
          <span />
          <b>node / production-01</b>
          <em>online</em>
        </header>
        <div className="pulse-guest-metrics">
          <strong>
            18<i>% CPU</i>
          </strong>
          <strong>
            42<i>% MEM</i>
          </strong>
          <strong>
            61<i>% DISK</i>
          </strong>
        </div>
        <svg viewBox="0 0 600 150">
          <path d="M0 112L50 100L100 106L150 64L200 77L250 42L300 58L350 35L400 75L450 58L500 87L550 52L600 69" />
        </svg>
      </div>
    </main>
  );
}

function Empty({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="pulse-empty">
      <p className="pulse-kicker">Zarkiv Pulse</p>
      <h1>{title}</h1>
      <p>{message}</p>
      {children}
    </main>
  );
}

function Loading() {
  return (
    <main className="pulse-loading" aria-label="Loading Pulse">
      <div />
      <div />
      <div />
    </main>
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

async function api<T = unknown>(
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
      data.message || "The request could not be completed.",
      response.status,
    );
  }
  return data as T;
}

function nodeState(node: NodeRecord): "pending" | "online" | "offline" {
  if (!node.enrolled_at) return "pending";
  if (!node.last_seen_at) return "offline";
  const grace = Math.max(90, node.interval_seconds * 3) * 1000;
  return Date.now() - parseTimestamp(node.last_seen_at) <= grace
    ? "online"
    : "offline";
}

function percentage(used: number | null, total: number | null): number | null {
  if (used === null || total === null || total <= 0) return null;
  return (used / total) * 100;
}

function relativeTime(value: string | null): string {
  if (!value) return "Never";
  const seconds = Math.round((parseTimestamp(value) - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  return formatter.format(hours, "hour");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request failed.";
}

function parseTimestamp(value: string): number {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Date.parse(normalized);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
