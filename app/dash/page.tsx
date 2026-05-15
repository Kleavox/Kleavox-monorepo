// app/dash/page.tsx

"use client";

import { useEffect, useState } from "react";
import { ExistingShortlinksCard, ShortLink } from "@/components/ExistingShortlinksCard";
import { CreateShortlinkCard } from "@/components/CreateShortlinkCard";
import AnalyticsModal from "@/components/AnalyticsModal";
import QrCodeModal from "@/components/QrCodeModal";
import EditShortlinkModal from "@/components/EditShortlinkModal";
import { Trash, Lightning, Cpu, CircleNotch } from "@phosphor-icons/react";

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

  const [pendingDeleteSlugs, setPendingDeleteSlugs] = useState<string[]>([]);
  const [deletingSlugs, setDeletingSlugs] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => { fetchLinks(1); }, []);

  async function fetchLinks(page = 1) {
    setLoadingTable(true);
    try {
      const res = await fetch(`/api/links?page=${page}&limit=10`);
      const data = await res.json();
      if (data.data) {
        setLinks(data.data);
        setTotalPages(data.meta.totalPages);
        setTotalItems(data.meta.total);
        setCurrentPage(data.meta.page);
      } else { setLinks([]); }
    } catch { setLinks([]); } finally { setLoadingTable(false); }
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
      fetchLinks(1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error");
    } finally { setLoading(false); }
  }

  async function confirmDelete() {
    if (pendingDeleteSlugs.length === 0) return;
    setDeleteLoading(true);
    try {
      await Promise.all(pendingDeleteSlugs.map(s => fetch(`/api/links/${s}`, { method: "DELETE" })));
      setDeletingSlugs(pendingDeleteSlugs);
      await new Promise(resolve => setTimeout(resolve, 400));
      setPendingDeleteSlugs([]);
      setDeletingSlugs([]);
      fetchLinks(currentPage);
    } catch { } finally { setDeleteLoading(false); }
  }

  const shortHost = process.env.NEXT_PUBLIC_SHORT_HOST || process.env.NEXT_PUBLIC_APP_HOST;
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "https";
  const baseUrl = shortHost ? `${protocol}://${shortHost}` : (typeof window !== "undefined" ? window.location.origin : "");
  const getDomainLabel = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

  return (
    <div className="flex flex-col gap-8 sm:gap-10 lg:gap-14">

      <section className="flex items-end justify-between gap-4 px-1">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-(--db-primary)">
            <Cpu size={15} />
            <span className="nothing-label tracking-widest text-(--db-primary)">Node_Active_01</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl nothing-title text-(--db-text)">DASHBOARD</h1>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-(--db-primary) animate-pulse shadow-[0_0_6px_rgba(163,230,53,0.6)]" />
            <span className="nothing-label normal-case tracking-normal opacity-40">{totalItems} Verified_Records</span>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-10 lg:gap-14">
        <div className="w-full max-w-4xl">
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
        </div>

        <div className="w-full space-y-5">
          <div className="flex items-center gap-2.5 px-1">
            <Lightning size={15} className="text-(--db-primary)" />
            <h2 className="nothing-label text-(--db-text) opacity-100 font-bold">Shortlink_Explorer</h2>
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
            onPageChange={(p) => fetchLinks(p)}
          />
        </div>
      </div>

      {analyticsSlug && <AnalyticsModal slug={analyticsSlug} onClose={() => setAnalyticsSlug(null)} />}
      {qrSlug && <QrCodeModal slug={qrSlug} shortUrl={`${baseUrl}/${qrSlug}`} onClose={() => setQrSlug(null)} />}
      {editingLink && <EditShortlinkModal link={editingLink} onClose={() => setEditingLink(null)} onUpdate={() => fetchLinks(currentPage)} />}

      {pendingDeleteSlugs.length > 0 && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-(--db-bg)/95 backdrop-blur-2xl animate-reveal">
          <div className="db-card w-full max-w-sm p-8 sm:p-10 space-y-8 text-center border-(--db-danger)/20">
            <div className="flex flex-col items-center gap-6">
              <div className="p-5 rounded-3xl bg-(--db-danger)/10 text-(--db-danger)">
                <Trash size={36} className="animate-soft-pulse" />
              </div>
              <div className="space-y-2">
                <h3 className="nothing-title text-2xl">TERMINATE</h3>
                <p className="nothing-label text-(--db-danger) font-bold">AUTH_REQUIRED</p>
              </div>
              <p className="nothing-label normal-case tracking-normal opacity-50 text-[10px] leading-relaxed">
                Initiating core data purge for {pendingDeleteSlugs.length} record(s). This operation is irreversible.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} disabled={deleteLoading} className="btn-danger w-full py-4 text-xs tracking-widest disabled:opacity-50">
                {deleteLoading ? <CircleNotch size={18} className="animate-spin" /> : "CONFIRM_PURGE"}
              </button>
              <button onClick={() => setPendingDeleteSlugs([])} className="btn-secondary w-full py-3 text-[10px] nothing-label opacity-100">ABORT_MISSION</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
