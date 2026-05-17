const BASE = process.env.NEXT_PUBLIC_API_BASE!;

async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { ...init, next: { revalidate: 10 } }); 
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${path} ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  uptime: {
    overview: () => getJSON<{
      totalChecks: number; healthy: number; degraded: number; down: number; avgLatencyMs: number | null;
    }>("/api/uptime/overview?hours=24"),
    summary: () => getJSON<Array<{
      id: string; name: string; targetUrl: string; enabled: boolean; intervalSec: number;
      last: { status: number | null; latencyMs: number | null; error: string | null; at: string } | null;
      metrics24h: { uptimePct: number | null; avgLatencyMs: number | null; samples: number }
    }>>("/api/uptime/summary"),
    logs: (id: string, limit = 30) =>
      getJSON<Array<{ id: string; status: number | null; latencyMs: number | null; createdAt: string }>>(`/api/uptime/checks/${id}/logs`).then(arr => arr.slice(0, limit)),
  },
  shortlinks: {
    list: () => getJSON<Array<{ id: string; slug: string; targetUrl: string; enabled: boolean; hits: number; createdAt: string }>>("/api/shortlinks"),
    top:   (limit = 10) => getJSON<Array<{ id: string; slug: string; hits: number }>>(`/api/shortlinks/stats/top?limit=${limit}`),
  }
};