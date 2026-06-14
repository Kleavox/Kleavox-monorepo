import { FormEvent, useMemo, useState } from "react";
import { apiFetch as api } from "@kleavox/core";
import type { Identity } from "@kleavox/core";

import { nodeState, percentage, relativeTime } from "./format";
import { AbuseReports } from "./reports";
import type {
  CheckRecord,
  Enrollment,
  Incident,
  NodeRecord,
  Note,
  Overview,
  Project,
} from "./types";
import { InlineEmpty, Metric, Resource, SectionTitle } from "./ui";

const NO_CHECKS: CheckRecord[] = [];

export function Dashboard({
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
  const [openReports, setOpenReports] = useState<number>();
  const nodeStates = useMemo(
    () => overview.nodes.map((node) => ({ node, state: nodeState(node) })),
    [overview.nodes],
  );
  const checksByNode = useMemo(() => {
    const map = new Map<string, CheckRecord[]>();
    for (const check of overview.checks) {
      const list = map.get(check.node_id);
      if (list) list.push(check);
      else map.set(check.node_id, [check]);
    }
    return map;
  }, [overview.checks]);
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
          <div className="pulse-command-readout" aria-hidden="true">
            <span>EDGE SIGNAL</span>
            <strong>{online.toString().padStart(2, "0")}</strong>
            <i />
          </div>
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
          label="Open reports"
          value={openReports === undefined ? "—" : String(openReports)}
          danger={(openReports ?? 0) > 0}
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
                  checks={checksByNode.get(node.id) ?? NO_CHECKS}
                  onRefresh={onRefresh}
                  onEnrollment={onEnrollment}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="pulse-side">
          <IncidentList incidents={overview.incidents} />
          <AbuseReports onCountChange={setOpenReports} />
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

export function EnrollmentDialog({
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
