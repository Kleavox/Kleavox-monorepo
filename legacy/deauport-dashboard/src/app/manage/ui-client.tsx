"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import {
  createCheckAction,
  toggleCheckAction,
  deleteCheckAction,
  createShortlinkAction,
  toggleShortlinkAction,
  deleteShortlinkAction,
} from "./actions";

type UptimeItem = {
  id: string;
  name: string;
  targetUrl: string;
  enabled: boolean;
  intervalSec: number;
  createdAt: string;
  updatedAt: string;
};

type ShortItem = {
  id: string;
  slug: string;
  targetUrl: string;
  enabled: boolean;
  hits: number;
  createdAt: string;
  updatedAt: string;
};

export function ManageClient() {
  const [loading, setLoading] = useState(true);
  const [checks, setChecks] = useState<UptimeItem[]>([]);
  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [error, setError] = useState<string>("");
  const toast = useToast();
  const confirm = useConfirm();

  const [apiBase, setApiBase] = useState<string>(process.env.NEXT_PUBLIC_API_BASE || "");
  useEffect(() => {
    if (!apiBase && typeof window !== "undefined") {
      const guess = `${location.protocol}//${location.hostname}:4000`;
      setApiBase(guess);
    }
  }, [apiBase]);

  const loadAll = useCallback(async () => {
    if (!apiBase) return;
    setLoading(true);
    setError("");
    try {
      const [c, s] = await Promise.all([
        fetch(`${apiBase}/api/uptime/checks`, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`GET /api/uptime/checks -> ${r.status}`);
          return r.json();
        }),
        fetch(`${apiBase}/api/shortlinks`, { cache: "no-store" }).then((r) => {
          if (!r.ok) throw new Error(`GET /api/shortlinks -> ${r.status}`);
          return r.json();
        }),
      ]);
      setChecks(c);
      setShorts(s);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch";
      setError(message);
      setChecks([]);
      setShorts([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function createCheck(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const targetUrl = String(form.get("targetUrl") ?? "").trim();
    const intervalSec = Number(form.get("intervalSec") ?? 60);
    try {
      await createCheckAction({ name, targetUrl, intervalSec });
      toast("Uptime check created");
      await loadAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create check";
      toast(message, "error");
    }
  }

  async function toggleCheck(id: string, enabled: boolean) {
    try {
      await toggleCheckAction(id, enabled);
      toast(enabled ? "Enabled" : "Disabled");
      await loadAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update check";
      toast(message, "error");
    }
  }

  async function removeCheck(id: string, name: string) {
    const ok = await confirm({
      title: "Delete check?",
      message: `Check “${name}” akan dihapus. Semua logs akan ikut terhapus.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteCheckAction(id);
      toast("Check deleted");
      await loadAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete check";
      toast(message, "error");
    }
  }

  async function createShort(form: FormData) {
    const slug = String(form.get("slug") ?? "").trim();
    const targetUrl = String(form.get("targetUrl") ?? "").trim();
    try {
      await createShortlinkAction({ slug, targetUrl });
      toast("Shortlink created");
      await loadAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create shortlink";
      toast(message, "error");
    }
  }

  async function toggleShort(id: string, enabled: boolean) {
    try {
      await toggleShortlinkAction(id, enabled);
      toast(enabled ? "Enabled" : "Disabled");
      await loadAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update shortlink";
      toast(message, "error");
    }
  }

  async function removeShort(id: string, slug: string) {
    const ok = await confirm({
      title: "Delete shortlink?",
      message: `Shortlink “/${slug}” akan dihapus. Tindakan ini tidak bisa dibatalkan.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteShortlinkAction(id);
      toast("Shortlink deleted");
      await loadAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete shortlink";
      toast(message, "error");
    }
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-xl border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {error} — cek CORS backend & NEXT_PUBLIC_API_BASE.
        </div>
      ) : null}

      <Card className="mb-6">
        <div className="mb-3 text-sm font-medium text-neutral-300">Uptime — Create</div>
        <form action={createCheck} className="grid gap-2 sm:grid-cols-[1fr,1.5fr,140px,120px]">
          <input name="name" placeholder="Name (unique)" className="input" required />
          <input name="targetUrl" placeholder="https://example.com" className="input" required />
          <input name="intervalSec" type="number" min={10} defaultValue={60} className="input" />
          <button className="btn btn-primary">Add Check</button>
        </form>
      </Card>

      <Card className="mb-10 p-0">
        <div className="border-b border-[var(--border)] px-4 py-2 text-sm text-neutral-300">Uptime — List</div>

        {loading ? (
          <div className="grid grid-cols-[1.2fr,1fr,1fr,200px] gap-4 px-4 py-3">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : checks.length === 0 ? (
          <div className="px-4 py-3 text-sm text-neutral-400">No checks.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 [grid-auto-rows:1fr]">
            {checks.map((c) => (
              <div key={c.id} className="card flex flex-col justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.name}</div>
                  <div className="truncate text-xs text-neutral-400">{c.targetUrl}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>{c.intervalSec}s</span>
                  <span className="text-subtle">{c.enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleCheck(c.id, !c.enabled)}
                    className="btn flex-1"
                  >
                    {c.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => removeCheck(c.id, c.name)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="mb-3 text-sm font-medium text-neutral-300">Shortlinks — Create</div>
        <form action={createShort} className="grid gap-2 sm:grid-cols-[180px,1fr,120px]">
          <div className="flex items-center">
            <span className="rounded-l-md border border-r-0 border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-neutral-500">
              /
            </span>
            <input name="slug" placeholder="my-slug" className="input rounded-l-none" required />
          </div>
          <input name="targetUrl" placeholder="https://target.example" className="input" required />
          <button className="btn btn-primary">Add</button>
        </form>
      </Card>

      <Card className="p-0">
        <div className="border-b border-[var(--border)] px-4 py-2 text-sm text-neutral-300">Shortlinks — List</div>

        {loading ? (
          <div className="grid grid-cols-3 gap-4 px-4 py-3">
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
            <Skeleton className="h-6" />
          </div>
        ) : shorts.length === 0 ? (
          <div className="px-4 py-3 text-sm text-neutral-400">No shortlinks.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 [grid-auto-rows:1fr]">
            {shorts.map((s) => (
              <div key={s.id} className="card flex flex-col justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm">
                    <span className="text-neutral-500">/</span>{s.slug}
                  </div>
                  <div className="truncate text-xs text-neutral-400">{s.targetUrl}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-300">{s.hits} hits</span>
                  <span className="text-subtle">{s.enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => toggleShort(s.id, !s.enabled)}
                    className="btn flex-1"
                  >
                    {s.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => removeShort(s.id, s.slug)}
                    className="btn btn-danger"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}