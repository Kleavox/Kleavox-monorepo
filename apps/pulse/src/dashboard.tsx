import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { apiFetch as api } from "@kleavox/core";
import type { Identity } from "@kleavox/core";
import { StatusLine, plural, useDialog } from "@kleavox/ui";

import { type NodeState, nodeState, percentage, relativeTime } from "./format";
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
import { ActionError, InlineEmpty, Metric, useAction } from "./ui";

const NO_CHECKS: CheckRecord[] = [];

const SECTIONS = [
  { id: "fleet", label: "fleet" },
  { id: "incidents", label: "incidents" },
  { id: "reports", label: "reports" },
  { id: "projects", label: "projects" },
] as const;

export function SectionNav() {
  const [current, setCurrent] = useState<string>("fleet");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (SECTIONS.some((section) => section.id === hash)) {
      document.getElementById(hash)?.scrollIntoView();
      setCurrent(hash);
    }

    const elements = SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter((element): element is HTMLElement => element !== null);
    if (elements.length === 0) return;

    const markerLine = 96;
    const observer = new IntersectionObserver(
      () => {
        let bestId: string | null = null;
        let bestTop = -Infinity;
        for (const element of elements) {
          const rect = element.getBoundingClientRect();
          if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
          if (rect.top > markerLine) continue;
          if (rect.top > bestTop) {
            bestTop = rect.top;
            bestId = element.id;
          }
        }
        if (bestId) setCurrent(bestId);
      },
      { threshold: Array.from({ length: 21 }, (_, index) => index / 20) },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <nav className="pulse-section-nav" aria-label="Pulse sections">
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={current === section.id ? "true" : undefined}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

function statePad(state: NodeState): string {
  if (state === "online") return "kvx-pad kvx-pad-ok";
  if (state === "pending") return "kvx-pad kvx-pad-warn";
  if (state === "disabled") return "kvx-pad";
  return "kvx-pad kvx-pad-danger";
}

function metricText(value: number | null, suffix = ""): string {
  return value === null
    ? "--"
    : `${value.toFixed(value >= 10 ? 0 : 1)}${suffix}`;
}

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
  const offline = nodeStates.filter(({ state }) => state === "offline").length;
  const openIncidents = overview.incidents.filter(
    (incident) => incident.status === "OPEN",
  ).length;
  const downChecks = overview.checks.filter(
    (check) => check.enabled && check.status === "DOWN",
  ).length;

  return (
    <main className="pulse-main">
      <div className="pulse-top">
        <p className="pulse-kicker">Workspace / {identity.email}</p>
        <StatusLine
          model={{
            tool: "pulse",
            fields: [
              { value: String(overview.nodes.length), label: "nodes" },
              {
                value: String(offline),
                label: "down",
                attention: offline > 0,
              },
              {
                value: String(downChecks),
                label: "checks failing",
                attention: downChecks > 0,
              },
              {
                value: openReports === undefined ? "…" : String(openReports),
                label: "reports open",
                attention: (openReports ?? 0) > 0,
              },
            ],
          }}
        />
        <CreateNode onCreated={onEnrollment} onRefresh={onRefresh} />
      </div>

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
          value={openReports === undefined ? "…" : String(openReports)}
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
        <section className="pulse-nodes" id="fleet">
          <p className="kvx-section-label">
            <span>Fleet</span>
            <b>
              {overview.nodes.length}{" "}
              {plural(overview.nodes.length, "node", "nodes")}
            </b>
          </p>
          {overview.nodes.length === 0 ? (
            <InlineEmpty message="Create a node to generate a one-time enrollment command." />
          ) : (
            <ul className="kvx-rows" role="list">
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
            </ul>
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
  const { error, run } = useAction();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await run(async () => {
        const result = await api<Enrollment>("/api/nodes", {
          method: "POST",
          body: JSON.stringify({ name, intervalSeconds: 60 }),
        });
        setName("");
        setOpen(false);
        onCreated(result);
        await onRefresh();
      });
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
      <ActionError message={error} />
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
  state: NodeState;
  checks: CheckRecord[];
  onRefresh: () => Promise<void>;
  onEnrollment: (value: Enrollment) => void;
}) {
  const memory = percentage(node.memory_used_bytes, node.memory_total_bytes);
  const disk = percentage(node.disk_used_bytes, node.disk_total_bytes);
  const checksUp = checks.filter((check) => check.status === "UP").length;
  const { error, run } = useAction();

  const renewEnrollment = () =>
    run(async () => {
      const result = await api<Enrollment>(`/api/nodes/${node.id}/enrollment`, {
        method: "POST",
      });
      onEnrollment(result);
    });

  return (
    <li className="pulse-node">
      <div className="kvx-row">
        <span className={statePad(state)} aria-hidden="true" />
        <span className="kvx-row-state">{state}</span>
        <span className="kvx-row-title">
          {node.name}
          <small className="kvx-row-detail">
            {[
              node.hostname,
              node.operating_system,
              node.architecture,
              node.agent_version,
            ]
              .filter(Boolean)
              .join(" / ") || "Awaiting agent enrollment"}
          </small>
          <small className="kvx-row-detail pulse-node-metrics">
            CPU {metricText(node.cpu_percent, "%")} · MEM{" "}
            {metricText(memory, "%")} · DISK {metricText(disk, "%")} · LOAD{" "}
            {metricText(node.load_1)}
          </small>
        </span>
        <span className="kvx-row-age">{relativeTime(node.last_seen_at)}</span>
        <span className="kvx-row-tool">
          {checks.length === 0 ? "--" : `${checksUp}/${checks.length}`}
        </span>
      </div>

      <div className="pulse-node-detail">
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
                  onClick={() =>
                    void run(async () => {
                      await api(`/api/checks/${check.id}`, {
                        method: "DELETE",
                      });
                      await onRefresh();
                    })
                  }
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
        <ActionError message={error} />
      </div>
    </li>
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
  const { error, run } = useAction();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    return run(async () => {
      await api("/api/checks", {
        method: "POST",
        body: JSON.stringify({
          nodeId,
          name,
          kind,
          target,
          timeoutSeconds: 10,
        }),
      });
      setName("");
      setTarget("");
      setOpen(false);
      await onRefresh();
    });
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
      <ActionError message={error} />
    </form>
  );
}

function IncidentList({ incidents }: { incidents: Incident[] }) {
  return (
    <section className="pulse-incidents" id="incidents">
      <p className="kvx-section-label">
        <span>Events</span>
        <b>
          {incidents.length} {plural(incidents.length, "incident", "incidents")}
        </b>
      </p>
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
  const { error, run } = useAction();

  return (
    <section className="pulse-projects" id="projects">
      <p className="kvx-section-label">
        <span>Context</span>
        <b>
          {projects.length} {plural(projects.length, "project", "projects")}
        </b>
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          return run(async () => {
            await api("/api/projects", {
              method: "POST",
              body: JSON.stringify({ name: projectName }),
            });
            setProjectName("");
            await onRefresh();
          });
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
              onChange={(event) => {
                const status = event.target.value;
                void run(async () => {
                  await api(`/api/projects/${project.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status }),
                  });
                  await onRefresh();
                });
              }}
            >
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <strong>{project.name}</strong>
            <button
              aria-label={`Delete ${project.name}`}
              onClick={() =>
                void run(async () => {
                  await api(`/api/projects/${project.id}`, {
                    method: "DELETE",
                  });
                  await onRefresh();
                })
              }
            >
              Remove
            </button>
          </article>
        ))}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          return run(async () => {
            await api("/api/notes", {
              method: "POST",
              body: JSON.stringify({ content: note, pinned: false }),
            });
            setNote("");
            await onRefresh();
          });
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
                onClick={() =>
                  void run(async () => {
                    await api(`/api/notes/${item.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ pinned: !item.pinned }),
                    });
                    await onRefresh();
                  })
                }
              >
                {item.pinned ? "Unpin" : "Pin"}
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    await api(`/api/notes/${item.id}`, { method: "DELETE" });
                    await onRefresh();
                  })
                }
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      <ActionError message={error} />
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
  const titleId = useId();
  const ref = useDialog<HTMLElement>(onClose);
  return createPortal(
    <div className="pulse-dialog-backdrop" role="presentation">
      <section
        ref={ref}
        tabIndex={-1}
        className="pulse-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <p className="pulse-kicker">One-time enrollment</p>
        <h2 id={titleId}>Connect this VPS.</h2>
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
    </div>,
    document.body,
  );
}
