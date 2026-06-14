import { useEffect, useState } from "react";
import { apiFetch as api, errorMessage } from "@kleavox/core";

import type { DropReport, LinkReport } from "./types";
import { InlineEmpty, SectionTitle } from "./ui";

export function AbuseReports({
  onCountChange,
}: {
  onCountChange?: (open: number) => void;
}) {
  const [linkReports, setLinkReports] = useState<LinkReport[]>();
  const [dropReports, setDropReports] = useState<DropReport[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = async () => {
    try {
      const [links, drops] = await Promise.all([
        api<{ reports: LinkReport[] }>("/api/admin/link/admin/reports"),
        api<{ reports: DropReport[] }>("/api/admin/drop/admin/file-reports"),
      ]);
      setLinkReports(links.reports);
      setDropReports(drops.reports);
      setError(undefined);
      const open =
        links.reports.filter((report) => report.status === "OPEN").length +
        drops.reports.filter((report) => report.status === "OPEN").length;
      onCountChange?.(open);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (run: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await run();
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const setLinkStatus = (id: string, status: string) =>
    act(() =>
      api(`/api/admin/link/admin/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    );

  const setDropStatus = (id: string, status: string) =>
    act(() =>
      api(`/api/admin/drop/admin/file-reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    );

  const disableLink = (slug: string) =>
    act(() =>
      api(`/api/admin/link/links/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        body: JSON.stringify({ disabled: true }),
      }),
    );

  const deleteFile = (token: string) => {
    if (!window.confirm("Delete this file permanently?")) return;
    void act(() =>
      api(`/api/admin/drop/public/${encodeURIComponent(token)}`, {
        method: "DELETE",
      }),
    );
  };

  return (
    <section aria-label="Abuse reports">
      <SectionTitle eyebrow="Moderation" title="Abuse reports" />
      {error && <p className="pulse-report-error">{error}</p>}
      {!linkReports || !dropReports ? (
        <InlineEmpty message="Loading reports..." />
      ) : linkReports.length === 0 && dropReports.length === 0 ? (
        <InlineEmpty message="No reports submitted." />
      ) : (
        <div className="pulse-report-list">
          {linkReports.map((report) => (
            <ReportCard
              key={report.id}
              label="LINK"
              report={report}
              target={`${
                report.slug
                  ? `/${report.slug} → ${report.target_url}`
                  : "Link removed"
              }${report.disabled_at ? " (disabled)" : ""}`}
              busy={busy}
              onStatus={(id, status) => void setLinkStatus(id, status)}
              extra={
                report.slug && !report.disabled_at
                  ? {
                      label: "Disable link",
                      onClick: () => void disableLink(report.slug!),
                    }
                  : undefined
              }
            />
          ))}
          {dropReports.map((report) => (
            <ReportCard
              key={report.id}
              label="FILE"
              report={report}
              target={`${report.original_name ?? "File removed"}${
                report.drop_status ? ` (${report.drop_status})` : ""
              }`}
              busy={busy}
              onStatus={(id, status) => void setDropStatus(id, status)}
              extra={
                report.public_token && report.drop_status === "ACTIVE"
                  ? {
                      label: "Delete file",
                      onClick: () => deleteFile(report.public_token!),
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ReportCard({
  label,
  report,
  target,
  busy,
  onStatus,
  extra,
}: {
  label: string;
  report: {
    id: string;
    reason: string;
    details: string | null;
    status: string;
    created_at: string;
  };
  target: string;
  busy: boolean;
  onStatus: (id: string, status: string) => void;
  extra?: { label: string; onClick: () => void };
}) {
  const open = report.status === "OPEN";
  return (
    <article className="pulse-report">
      <header>
        <strong>
          {label} / {report.reason}
          {open ? "" : ` / ${report.status}`}
        </strong>
        <span>{report.created_at}</span>
      </header>
      <p>{target}</p>
      {report.details && <p>{report.details}</p>}
      <div className="pulse-report-actions">
        {open && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus(report.id, "RESOLVED")}
            >
              Resolve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onStatus(report.id, "REJECTED")}
            >
              Reject
            </button>
          </>
        )}
        {extra && (
          <button type="button" disabled={busy} onClick={extra.onClick}>
            {extra.label}
          </button>
        )}
      </div>
    </article>
  );
}
