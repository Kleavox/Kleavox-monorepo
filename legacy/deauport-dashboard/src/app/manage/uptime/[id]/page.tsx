import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { Card, Subtle, StatusBadge } from "@/components/ui";
import { Sparkline } from "@/components/sparkline";

type Check = {
  id: string; name: string; targetUrl: string; enabled: boolean; intervalSec: number;
  last: { status: number | null; latencyMs: number | null; error: string | null; at: string } | null;
  metrics24h: { uptimePct: number | null; avgLatencyMs: number | null; samples: number };
};
type Log = { id: string; status: number | null; latencyMs: number | null; createdAt: string };

const BASE = process.env.NEXT_PUBLIC_API_BASE!;

async function getJSON<T>(path: string) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

function prepareSparklineData(logs: Log[], intervalSec: number): (number | null)[] {
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

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ h?: string }>;
}) {
  const { id } = await params;
  const { h } = await searchParams;
  const hoursRaw = Number(h ?? 24);
  const hours = [6, 12, 24].includes(hoursRaw) ? hoursRaw : 24;

  const list = await getJSON<Check[]>(`/api/uptime/summary?hours=${hours}`);
  const item = list.find((x) => x.id === id);
  if (!item) return notFound();

  const logs = await getJSON<Log[]>(`/api/uptime/checks/${id}/logs`);
  const series = prepareSparklineData(logs, item.intervalSec);

  const st = item.last?.status ?? null;
  const colorClass =
    st == null ? "text-[var(--danger)]"
    : st >= 200 && st < 400 ? "text-[var(--primary)]"
    : st >= 400 && st < 500 ? "text-[var(--warning)]"
    : "text-[var(--danger)]";

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={item.targetUrl}
        actions={
          <div className="flex gap-2">
            <a href={`/manage/uptime/${id}?h=6`}  className={`btn ${hours===6  ? "btn-primary":"btn-ghost"}`}>6h</a>
            <a href={`/manage/uptime/${id}?h=12`} className={`btn ${hours===12 ? "btn-primary":"btn-ghost"}`}>12h</a>
            <a href={`/manage/uptime/${id}?h=24`} className={`btn ${hours===24 ? "btn-primary":"btn-ghost"}`}>24h</a>
          </div>
        }
      />

      <div className="mx-auto max-w-6xl px-4">
        <div className="mt-3">
          <Breadcrumbs
            items={[
              { label: "Dashboard", href: "/" },
              { label: "Manage", href: "/manage" },
              { label: "Uptime", href: "/manage/uptime" },
              { label: item.name },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <div className="text-muted text-sm">Status</div>
            <div className="mt-2"><StatusBadge code={st} /></div>
            <Subtle className="mt-1">{item.enabled ? "Enabled" : "Disabled"} · {item.intervalSec}s</Subtle>
          </Card>
          <Card>
            <div className="text-muted text-sm">Uptime ({hours}h)</div>
            <div className="mt-1 text-2xl font-semibold">{item.metrics24h.uptimePct ?? "—"}%</div>
          </Card>
          <Card>
            <div className="text-muted text-sm">Avg Latency ({hours}h)</div>
            <div className="mt-1 text-2xl font-semibold">{item.metrics24h.avgLatencyMs ?? "—"} ms</div>
          </Card>
          <Card>
            <div className="text-muted text-sm">Samples ({hours}h)</div>
            <div className="mt-1 text-2xl font-semibold">{item.metrics24h.samples ?? 0}</div>
          </Card>
        </div>

        <div className="mt-6">
          <Card>
            <div className="mb-3 text-sm font-medium text-neutral-300">Latency sparkline</div>
            <div className="text-neutral-300">
              <Sparkline points={series.slice(-200)} className={colorClass} height={72} />
              <div className="mt-2 flex items-center justify-between text-xs text-subtle">
                <span>older</span><span>newer</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6">
          <Card className="p-0 overflow-hidden">
            <div className="border-b border-[var(--border)] px-4 py-2 text-sm text-neutral-300">
              Recent Requests
            </div>
            <div className="divide-y divide-[var(--border)]">
              {logs.slice(0, 50).map((l) => (
                <div key={l.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <div className="w-28 text-xs text-subtle">
                    {new Date(l.createdAt).toLocaleString()}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs text-subtle">Latency</span>{" "}
                    {l.latencyMs ?? "—"} ms
                  </div>
                  <div className="min-w-24 text-right">
                    <StatusBadge code={l.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}