import { prisma } from "./prisma.js";
import { setTimeout as sleep } from "timers/promises";
import { performance } from "perf_hooks";

type Logger = { info: Function; warn: Function; error: Function };

let lastCleanup = 0;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;
const RETAIN_DAYS = Number(process.env.UPTIME_RETAIN_DAYS ?? 31);

const CONCURRENCY = Number(process.env.PING_CONCURRENCY ?? 5);
const TIMEOUT_MS = Number(process.env.PING_TIMEOUT_MS ?? 10_000);
const TICK_MS = Number(process.env.PING_TICK_MS ?? 15_000);

class Semaphore {
  private max: number;
  private curr = 0;
  private q: (() => void)[] = [];
  constructor(max: number) { this.max = max; }
  async acquire() {
    if (this.curr < this.max) { this.curr++; return; }
    await new Promise<void>(res => this.q.push(res));
    this.curr++;
  }
  release() {
    this.curr--;
    const next = this.q.shift();
    if (next) next();
  }
}

async function pingOnce(targetUrl: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = performance.now();

  try {
    const res = await fetch(targetUrl, { signal: controller.signal });
    const latencyMs = Math.round(performance.now() - start);
    return { status: res.status, latencyMs, error: null as string | null };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { status: null as number | null, latencyMs, error: err?.message ?? "request_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function startUptimePinger(log: Logger) {
  let stopped = false;
  const sem = new Semaphore(CONCURRENCY);

  async function tick() {
    if (stopped) return;

    try {
      const checks = await prisma.uptimeCheck.findMany({
        where: { enabled: true },
        orderBy: { updatedAt: "asc" },
        take: 200,
      });

      const now = Date.now();
      const due = checks.filter((c) => {
        const last = new Date(c.updatedAt).getTime();
        return now - last >= Math.max(10_000, c.intervalSec * 1000);
      });

      if (due.length === 0) {
        log.info({ tick: "idle" }, "uptime: no due checks");
        return;
      }

      log.info({ count: due.length }, "uptime: running pings");

      await Promise.all(due.map(async (c) => {
        await sem.acquire();
        try {
          const { status, latencyMs, error } = await pingOnce(c.targetUrl);
          await prisma.uptimeLog.create({
            data: {
              checkId: c.id,
              status: status ?? undefined,
              latencyMs: latencyMs ?? undefined,
              error: error ?? undefined,
            },
          });
          await prisma.uptimeCheck.update({
            where: { id: c.id },
            data: { updatedAt: new Date() },
          });
        } catch (e) {
          log.error({ checkId: c.id, err: (e as any)?.message }, "uptime: failed to record log");
        } finally {
          sem.release();
        }
      }));
      const nowMs = Date.now();
      if (nowMs - lastCleanup > CLEANUP_EVERY_MS) {
        lastCleanup = nowMs;
        const cutoff = new Date(nowMs - RETAIN_DAYS * 24 * 60 * 60 * 1000);
        try {
          const deleted = await prisma.uptimeLog.deleteMany({
            where: { createdAt: { lt: cutoff } }
          });
          log.info({ deleted: deleted.count, cutoff: cutoff.toISOString() }, "uptime: retention cleanup");
        } catch (err: any) {
          log.warn({ err: err?.message }, "uptime: retention cleanup failed");
        }
      }      
    } catch (e) {
      log.error({ err: (e as any)?.message }, "uptime: tick error");
    }
  }

  (async () => {
    while (!stopped) {
      await tick();
      await sleep(TICK_MS);
    }
  })();

  return () => { stopped = true; };
}