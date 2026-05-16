// app/dash/page.tsx

"use client";

import { useEffect, useState, useRef } from "react";
import { ExistingShortlinksCard, ShortLink } from "@/components/ExistingShortlinksCard";
import { CreateShortlinkCard } from "@/components/CreateShortlinkCard";
import AnalyticsModal from "@/components/AnalyticsModal";
import QrCodeModal from "@/components/QrCodeModal";
import EditShortlinkModal from "@/components/EditShortlinkModal";
import ShortlinkResultModal from "@/components/ShortlinkResultModal";
import { Trash, CircleNotch } from "@phosphor-icons/react";
import type { ShortlinkResult } from "@/types";

export default function DashboardPage() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [targetUrl, setTargetUrl] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const [loading, setLoading] = useState(false);
  const [loadingTable, setLoadingTable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [analyticsSlug, setAnalyticsSlug] = useState<string | null>(null);
  const [qrSlug, setQrSlug] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<ShortLink | null>(null);

  const [createdLink, setCreatedLink] = useState<ShortlinkResult | null>(null);
  const [pendingDeleteSlugs, setPendingDeleteSlugs] = useState<string[]>([]);
  const [deletingSlugs, setDeletingSlugs] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchLinks(1, true);

    // Poll every 10s for cross-device sync (silent, no loading spinner)
    const interval = setInterval(() => fetchLinks(currentPageRef.current), 10000);

    // Refresh immediately when tab becomes visible again
    const onVisible = () => { if (document.visibilityState === "visible") fetchLinks(currentPageRef.current); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const currentPageRef = useRef(1);

  async function fetchLinks(page = 1, showLoader = false) {
    if (showLoader) setLoadingTable(true);
    try {
      const res = await fetch(`/api/links?page=${page}&limit=10`);
      const data = await res.json();
      if (data.data) {
        setLinks(data.data);
        setTotalPages(data.meta.totalPages);
        setTotalItems(data.meta.total);
        setCurrentPage(data.meta.page);
        currentPageRef.current = data.meta.page;
      } else { setLinks([]); }
    } catch { setLinks([]); } finally { if (showLoader) setLoadingTable(false); }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, slug: slug || undefined, password: password || undefined, expiresAt: expiresAt || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setTargetUrl(""); setSlug(""); setPassword(""); setExpiresAt("");
      setCreatedLink({ slug: data.slug, shortUrl: data.shortUrl });
      fetchLinks(1, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setLoading(false); }
  }

  async function confirmDelete() {
    if (!pendingDeleteSlugs.length) return;
    setDeleteLoading(true);
    try {
      await Promise.all(pendingDeleteSlugs.map(s => fetch(`/api/links/${s}`, { method: "DELETE" })));
      setDeletingSlugs(pendingDeleteSlugs);
      await new Promise(r => setTimeout(r, 400));
      setPendingDeleteSlugs([]); setDeletingSlugs([]);
      fetchLinks(currentPage, true);
    } catch { } finally { setDeleteLoading(false); }
  }

  const shortHost = process.env.NEXT_PUBLIC_SHORT_HOST || process.env.NEXT_PUBLIC_APP_HOST;
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "https";
  const baseUrl = shortHost ? `${protocol}://${shortHost}` : (typeof window !== "undefined" ? window.location.origin : "");
  const getDomainLabel = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

  return (
    <div className="flex flex-col gap-6 sm:gap-8">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 px-1">
        <div>
          <p className="nothing-label text-(--db-primary) mb-2">Node_Active_01</p>
          <h1 className="text-4xl sm:text-5xl nothing-title">DASHBOARD</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-(--db-primary) animate-pulse shadow-[0_0_6px_rgba(163,230,53,0.5)]" />
          <span className="nothing-label normal-case tracking-normal opacity-50">{totalItems} links active</span>
        </div>
      </div>

      {/* ── Main Grid: form left | explorer right on desktop ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 lg:gap-8 items-start">

        {/* Create Link */}
        <CreateShortlinkCard
          targetUrl={targetUrl}
          slug={slug}
          password={password}
          expiresAt={expiresAt}
          loading={loading}
          error={error}
          onSubmit={handleCreate}
          onChangeTarget={setTargetUrl}
          onChangeSlug={setSlug}
          onChangePassword={setPassword}
          onChangeExpiresAt={setExpiresAt}
        />

        {/* Link Explorer */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-1">
            <p className="nothing-label opacity-100">Shortlink_Explorer</p>
            <p className="nothing-label opacity-30 normal-case tracking-normal">{totalItems} total</p>
          </div>
          <ExistingShortlinksCard
            links={links}
            loadingTable={loadingTable}
            baseUrl={baseUrl}
            getDomainLabel={getDomainLabel}
            onDelete={(slugs) => setPendingDeleteSlugs(slugs)}
            deletingSlugs={deletingSlugs}
            onEdit={(link) => setEditingLink(link)}
            onViewStats={(s) => setAnalyticsSlug(s)}
            onViewQr={(s) => setQrSlug(s)}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onPageChange={(p) => fetchLinks(p, true)}
          />
        </div>

      </div>

      {/* ── Modals ── */}
      {createdLink && <ShortlinkResultModal result={createdLink} onClose={() => setCreatedLink(null)} />}
      {analyticsSlug && <AnalyticsModal slug={analyticsSlug} onClose={() => setAnalyticsSlug(null)} />}
      {qrSlug && <QrCodeModal slug={qrSlug} shortUrl={`${baseUrl}/${qrSlug}`} onClose={() => setQrSlug(null)} />}
      {editingLink && <EditShortlinkModal link={editingLink} onClose={() => setEditingLink(null)} onUpdate={() => fetchLinks(currentPage, true)} />}

      {/* ── Delete Confirm ── */}
      {pendingDeleteSlugs.length > 0 && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-reveal">
          <div className="db-card w-full max-w-xs p-8 space-y-6 text-center">
            <div className="inline-flex p-5 bg-(--db-danger)/10 text-(--db-danger) rounded-3xl">
              <Trash size={32} className="animate-soft-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="nothing-title text-xl">TERMINATE</h3>
              <p className="nothing-label text-(--db-danger)">IRREVERSIBLE_ACTION</p>
              <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px] pt-1">
                {pendingDeleteSlugs.length} record(s) will be permanently deleted.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button onClick={confirmDelete} disabled={deleteLoading} className="btn-danger w-full py-3.5 text-xs tracking-widest disabled:opacity-40">
                {deleteLoading ? <CircleNotch size={16} className="animate-spin" /> : "CONFIRM_PURGE"}
              </button>
              <button onClick={() => setPendingDeleteSlugs([])} className="btn-secondary w-full py-3 text-[10px] nothing-label opacity-100">
                ABORT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
