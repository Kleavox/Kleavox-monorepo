import { Shell } from "@/components/shell";
import { getAuthed } from "@/lib/session";
import { Card, H1, Subtle, StatusBadge } from "@/components/ui";
import { Sparkline } from "@/components/sparkline";

type SummaryItem = {
  id: string;
  name: string;
  targetUrl: string;
  enabled: boolean;
  intervalSec: number;
  last: { status: number | null; latencyMs: number | null; error: string | null; at: string } | null;
  metrics24h: { uptimePct: number | null; avgLatencyMs: number | null; samples: number };
};

type Overview = {
  totalChecks: number;
  healthy: number;
  degraded: number;
  down: number;
  avgLatencyMs: number | null;
};

type LogItem = { id: string; status: number | null; latencyMs: number | null; createdAt: string };

const BASE = process.env.NEXT_PUBLIC_API_BASE!;

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function prepareSparklineData(logs: LogItem[], intervalSec: number): (number | null)[] {
  if (logs.length < 2) {
    return logs.map(l => l.latencyMs ?? null).reverse();
  }

  const sortedLogs = [...logs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  const points: (number | null)[] = [];
  const gapThreshold = intervalSec * 1000 * 3;

  for (let i = 0; i < sortedLogs.length; i++) {
    points.push(sortedLogs[i].latencyMs ?? null);

    if (i < sortedLogs.length - 1) {
      const time1 = new Date(sortedLogs[i].createdAt).getTime();
      const time2 = new Date(sortedLogs[i+1].createdAt).getTime();
      if (time2 - time1 > gapThreshold) {
        points.push(null);
      }
    }
  }
  return points;
}


export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Deauport — Dashboard" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ h?: string }>;
}) {
  const authed = await getAuthed();
  const { h } = await searchParams;
  const hoursRaw = Number(h ?? 24);
  const hours = [6, 12, 24].includes(hoursRaw) ? hoursRaw : 24;

  const [overview, summary] = await Promise.all([
    fetchJSON<Overview>(`/api/uptime/overview?hours=${hours}`),
    fetchJSON<SummaryItem[]>(`/api/uptime/summary?hours=${hours}`),
  ]);

  const renderHeader = () => (
    <div className="flex items-end justify-between">
      <div>
        <H1>Dashboard</H1>
        <Subtle className="mt-1">Ringkasan uptime {hours} jam terakhir.</Subtle>
      </div>
      <div className="flex gap-2">
        {[6, 12, 24].map((opt) => {
          const active = hours === opt;
          return (
            <a key={opt} href={`/?h=${opt}`} className={`btn ${active ? "btn-primary" : "btn-ghost"}`}>
              {opt}h
            </a>
          );
        })}
      </div>
    </div>
  );

  if (!summary || summary.length === 0) {
    return (
      <Shell authed={authed}>
        {renderHeader()}
        <Card className="mt-6 flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-2 text-5xl">🌱</div>
          <div className="font-medium">Belum ada uptime checks</div>
          <p className="mt-1 text-sm text-muted">
            Tambahkan check pertama di tab <span className="font-medium">Manage</span>.
          </p>
        </Card>
      </Shell>
    );
  }

  const featured = [...summary]
    .sort((a, b) => (b.metrics24h.samples ?? 0) - (a.metrics24h.samples ?? 0))
    .slice(0, 6);

  const logsPerCheck = await Promise.all(
    featured.map((c) => fetchJSON<LogItem[]>(`/api/uptime/checks/${c.id}/logs`))
  );
  const downEvents = logsPerCheck.flat().filter((l) => l.status == null || l.status >= 500).length;

  const uptimeValues = summary
    .map((s) => s.metrics24h.uptimePct)
    .filter((v): v is number => v != null);
  const avgUptimePct = uptimeValues.length
    ? Math.round((uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length) * 10) / 10
    : null;

  const latencyValues = summary
    .map((s) => s.metrics24h.avgLatencyMs)
    .filter((v): v is number => v != null);
  const avgLatency = latencyValues.length
    ? Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length)
    : null;

  const isOdd = featured.length % 2 === 1;

  return (
    <Shell authed={authed}>
      {renderHeader()}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="text-muted text-sm">Total Checks</div>
          <div className="mt-1 text-2xl font-semibold">{overview.totalChecks}</div>
        </Card>
        <Card>
          <div className="text-muted text-sm">Avg Uptime ({hours}h)</div>
          <div className="mt-1 text-2xl font-semibold">{avgUptimePct ?? "—"}%</div>
          <Subtle>Healthy: {overview.healthy} / {overview.totalChecks}</Subtle>
        </Card>
        <Card>
          <div className="text-muted text-sm">Avg Latency ({hours}h)</div>
          <div className="mt-1 text-2xl font-semibold">{avgLatency ?? "—"} ms</div>
          <Subtle>Degraded/Down: {overview.degraded}/{overview.down}</Subtle>
        </Card>
        <Card>
          <div className="text-muted text-sm">Down Events (sampled)</div>
          <div className="mt-1 text-2xl font-semibold">{downEvents}</div>
          <Subtle>Dari {featured.length} checks</Subtle>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {featured.map((c, i) => {
            const logs = logsPerCheck[i]?.slice(0, 30) ?? [];
            const series = prepareSparklineData(logs, c.intervalSec);

            const st = c.last?.status ?? null;
            const colorClass =
              st == null
                ? "text-[var(--danger)]"
                : st >= 200 && st < 400
                ? "text-[var(--primary)]"
                : st >= 400 && st < 500
                ? "text-[var(--warning)]"
                : "text-[var(--danger)]";

            return (
              <Card
                key={c.id}
                className={`h-[190px] ${isOdd && i === 0 ? "sm:col-span-2" : ""}`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <a
                      href={c.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate text-xs text-subtle hover:underline"
                      title={c.targetUrl}
                    >
                      {c.targetUrl}
                    </a>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-sm">
                    <StatusBadge code={st} />
                    <div className="text-xs text-subtle">
                      {c.metrics24h.uptimePct ?? "—"}% up · {c.metrics24h.avgLatencyMs ?? "—"} ms
                    </div>
                  </div>
                </div>

                <div className="text-neutral-300">
                  <Sparkline points={series} className={colorClass} height={64} />
                  <div className="mt-2 flex items-center justify-between text-xs text-subtle">
                    <span>older</span>
                    <span>newer</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-col">
          <Card className="flex min-h-full flex-col">
            <div className="mb-3 text-sm font-medium text-neutral-300">Latest Status</div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/40">
              <div className="divide-y divide-[var(--border)]">
                {summary.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{c.name}</div>
                      <a
                        href={c.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs text-subtle hover:underline"
                        title={c.targetUrl}
                      >
                        {c.targetUrl}
                      </a>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <StatusBadge code={c.last?.status ?? null} />
                      <div className="text-right">
                        <div>{c.metrics24h.uptimePct ?? "—"}% up</div>
                        <div className="text-xs text-subtle">
                          {c.metrics24h.avgLatencyMs ?? "—"} ms
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}