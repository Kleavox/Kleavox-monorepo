"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/confirm";
import {
  toggleShortlinkAction,
  deleteShortlinkAction,
} from "../actions";
import { StatusBadge } from "@/components/ui";

type ShortItem = {
  id: string;
  slug: string;
  targetUrl: string;
  enabled: boolean;
  hits: number;
  createdAt: string;
  updatedAt: string;
};

const VISIBLE = 6;

export function ShortlinksClient() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<ShortItem[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);

  const toast = useToast();
  const confirm = useConfirm();

  const [shortlinkBaseUrl, setShortlinkBaseUrl] = useState('');

  useEffect(() => {
    const envBase = process.env.NEXT_PUBLIC_SHORT_BASE || window.location.origin;
    setShortlinkBaseUrl(envBase.replace(/\/+$/, ''));
  }, []);


  const [apiBase, setApiBase] = useState<string>(process.env.NEXT_PUBLIC_API_BASE || "");
  useEffect(() => {
    if (!apiBase && typeof window !== "undefined") {
      setApiBase(`${location.protocol}//${location.hostname}:4000`);
    }
  }, [apiBase]);

  const load = useCallback(async () => {
    if (!apiBase) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/shortlinks`, { cache: "no-store" });
      if (!res.ok) throw new Error(`GET /shortlinks -> ${res.status}`);
      setList(await res.json());
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to fetch";
      setError(message);
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    function onReload() { load(); }
    window.addEventListener("reload-shortlinks", onReload);
    return () => window.removeEventListener("reload-shortlinks", onReload);
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term
      ? list.filter(x =>
          x.slug.toLowerCase().includes(term) ||
          x.targetUrl.toLowerCase().includes(term)
        )
      : list;
  }, [list, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / VISIBLE));
  const pageSafe = Math.max(1, Math.min(page, totalPages));
  const pageSlice = filtered.slice((pageSafe - 1) * VISIBLE, pageSafe * VISIBLE);

  async function onToggle(id: string, enabled: boolean) {
    try {
      await toggleShortlinkAction(id, enabled);
      toast(enabled ? "Enabled" : "Disabled");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to update shortlink";
      toast(message, "error");
    }
  }
  async function onDelete(id: string, slug: string) {
    const ok = await confirm({
      title: "Delete shortlink?",
      message: `Shortlink “/${slug}” akan dihapus.`,
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await deleteShortlinkAction(id);
      toast("Shortlink deleted");
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete shortlink";
      toast(message, "error");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search slug / URL…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
        />
        <div className="flex items-center gap-3">
          <span className="text-sm text-subtle">
            {filtered.length} items · page {pageSafe}/{totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              aria-label="Previous"
            >
              ‹
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageSafe >= totalPages}
              aria-label="Next"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          {error}
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: VISIBLE }).map((_, i) => (
            <div key={i} className="card h-[160px]"><Skeleton className="h-full" /></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex items-center justify-center py-12 text-center text-subtle">
          Tidak ada data.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageSlice.map((s) => {
            const fullShortUrl = `${shortlinkBaseUrl}/${s.slug}`;
            const displayUrl = fullShortUrl.replace(/^https?:\/\//, '');

            return (
              <div key={s.id} className="card flex h-full flex-col justify-between p-4">
                <div>
                  <a
                    href={fullShortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                    title={fullShortUrl}
                  >
                    {displayUrl}
                  </a>
                  <a
                    href={s.targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-xs text-neutral-400 hover:underline"
                    title={s.targetUrl}
                  >
                    {s.targetUrl}
                  </a>
                </div>
                <div className="my-3 flex items-center justify-between text-sm">
                  <span className="text-subtle">{s.hits} hits</span>
                  <StatusBadge code={s.enabled ? 200 : 503} message={s.enabled ? "Enabled" : "Disabled"} />
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn flex-1" onClick={() => onToggle(s.id, !s.enabled)}>
                    {s.enabled ? "Disable" : "Enable"}
                  </button>
                  <button className="btn btn-danger" onClick={() => onDelete(s.id, s.slug)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}