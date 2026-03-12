// app/dash/page.tsx

"use client";

import { useEffect, useState } from "react";
import DeauBitLogo from "@/components/DeauBitLogo";
import UserMenu from "@/components/UserMenu";
import { ExistingShortlinksCard, ShortLink } from "@/components/ExistingShortlinksCard";
import { CreateShortlinkCard } from "@/components/CreateShortlinkCard";
import AnalyticsModal from "@/components/AnalyticsModal";
import QrCodeModal from "@/components/QrCodeModal";
import EditShortlinkModal from "@/components/EditShortlinkModal"; 
import { Trash2, Loader2, ExternalLink, X, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [userEmail, setUserEmail] = useState("User");
  const [userRole, setUserRole] = useState("USER");
  
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
  
  const [selectedLink, setSelectedLink] = useState<ShortLink | null>(null);
  const [analyticsSlug, setAnalyticsSlug] = useState<string | null>(null);
  const [qrSlug, setQrSlug] = useState<string | null>(null); 
  const [editingLink, setEditingLink] = useState<ShortLink | null>(null);

  const [pendingDeleteSlugs, setPendingDeleteSlugs] = useState<string[]>([]);
  const [deletingSlugs, setDeletingSlugs] = useState<string[]>([]);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/session").then(r => r.json()).then(data => {
        if(data.user?.email) setUserEmail(data.user.email);
        if(data.user?.name) setUserEmail(data.user.name);
        if(data.user?.role) setUserRole(data.user.role);
    });
    fetchLinks(1);
  }, []);

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
      } else {
          setLinks([]);
      }
    } catch {
      setLinks([]);
    } finally {
      setLoadingTable(false);
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          slug: slug || undefined,
          password: password || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");

      setTargetUrl(""); setSlug(""); setPassword(""); setExpiresAt("");
      fetchLinks(1);
    } catch {
      setError("Error");
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (pendingDeleteSlugs.length === 0) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
        const deletePromises = pendingDeleteSlugs.map(slug => 
            fetch(`/api/links/${slug}`, { method: "DELETE" })
        );
        await Promise.all(deletePromises);
        
        
        setDeletingSlugs(pendingDeleteSlugs);
        
        
        await new Promise(resolve => setTimeout(resolve, 400));
        
        setPendingDeleteSlugs([]);
        setDeletingSlugs([]);
        fetchLinks(currentPage); 
    } catch {
        setDeleteError("Failed to delete. Please try again.");
    } finally {
        setDeleteLoading(false);
    }
  }

  const changePage = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          fetchLinks(newPage);
      }
  };

  const shortHost = process.env.NEXT_PUBLIC_SHORT_HOST || process.env.NEXT_PUBLIC_APP_HOST;
  const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "https";
  const baseUrl = shortHost ? `${protocol}://${shortHost}` : (typeof window !== "undefined" ? window.location.origin : "");
  const getDomainLabel = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

  return (
    <div className="w-full h-full flex flex-col gap-6">
      
      <header className="bg-(--db-surface) border-4 border-(--db-border) p-3 lg:p-4 shadow-[4px_4px_0px_0px_var(--db-border)] lg:shadow-[8px_8px_0px_0px_var(--db-border)] flex items-center justify-between sticky top-0 lg:top-4 z-30 transition-colors">
        <div className="flex items-center gap-3">
          <div className="bg-(--db-text) p-1">
             <DeauBitLogo size={24} />
          </div>
          <span className="text-lg lg:text-xl font-black uppercase tracking-tighter hidden sm:block text-(--db-text)">Dashboard</span>
        </div>
        <UserMenu username={userEmail} role={userRole} />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_400px] gap-6 lg:gap-8 items-start relative">
        <div className="order-2 lg:order-1 min-w-0 h-full flex flex-col animate-in fade-in slide-in-from-left-8 duration-700 delay-100 fill-mode-both">
            <ExistingShortlinksCard
              links={links}
              loadingTable={loadingTable}
              baseUrl={baseUrl}
              getDomainLabel={getDomainLabel}
              onDelete={(slugs) => setPendingDeleteSlugs(slugs)}
              deletingSlugs={deletingSlugs}
              onEdit={(link) => setEditingLink(link)}
              onViewTarget={(link) => setSelectedLink(link)}
              onViewStats={(slug) => setAnalyticsSlug(slug)}
              onViewQr={(slug) => setQrSlug(slug)}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              onPageChange={changePage}
            />
        </div>

        <div className="order-1 lg:order-2 lg:sticky lg:top-40 z-10 animate-in fade-in slide-in-from-right-8 duration-700 delay-300 fill-mode-both">
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
      </div>

      <div className="db-card p-6 shadow-[8px_8px_0px_0px_var(--db-border)] flex flex-col md:flex-row items-center justify-between gap-4 mt-4">
          <div className="flex flex-col items-center md:items-start">
             <span className="text-xs font-black uppercase tracking-widest text-(--db-text)">DEAUBIT</span>
             <span className="text-[10px] font-bold text-(--db-text-muted)">Powered by Deauport</span>
          </div>
          <div className="flex flex-wrap justify-center gap-6 text-xs font-bold text-(--db-text-muted)">
             <Link href="/terms" className="hover:text-(--db-text) hover:underline transition-colors">Terms</Link>
             <Link href="/privacy" className="hover:text-(--db-text) hover:underline transition-colors">Privacy</Link>
             <Link href="/report" className="text-red-500 hover:text-red-700 hover:underline flex items-center gap-1 transition-colors">
                <AlertTriangle className="h-3 w-3" /> Report Abuse
             </Link>
          </div>
          <div className="text-[10px] font-bold text-(--db-text-muted)">
             &copy; {new Date().getFullYear()}
          </div>
      </div>

      {analyticsSlug && <AnalyticsModal slug={analyticsSlug} onClose={() => setAnalyticsSlug(null)} />}
      {qrSlug && <QrCodeModal slug={qrSlug} shortUrl={`${baseUrl}/${qrSlug}`} onClose={() => setQrSlug(null)} />}
      
      {editingLink && (
        <EditShortlinkModal 
            link={editingLink} 
            onClose={() => setEditingLink(null)} 
            onUpdate={() => fetchLinks(currentPage)} 
        />
      )}
      
      {pendingDeleteSlugs.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="db-card w-full max-w-sm p-6 shadow-[12px_12px_0px_0px_var(--db-text)]">
            <div className="flex items-center gap-3 text-red-600 mb-4 border-b-4 border-(--db-border) pb-2">
                <div className="p-2 bg-red-100 rounded-full animate-warning-glow">
                    <Trash2 className="h-6 w-6"/>
                </div>
                <h3 className="font-black text-xl uppercase text-(--db-text)">Confirm?</h3>
            </div>
            <p className="font-bold text-(--db-text) mb-6 text-sm">Delete {pendingDeleteSlugs.length} link(s)? This action is permanent.</p>
            {deleteError && (
              <div className="mb-4 bg-(--db-danger) text-white text-xs font-bold p-2 border-2 border-(--db-border) text-center">{deleteError}</div>
            )}
            <div className="flex gap-2">
                <button onClick={() => { setPendingDeleteSlugs([]); setDeleteError(null); }} className="flex-1 py-3 font-bold border-2 border-(--db-border) text-(--db-text) hover:bg-(--db-bg) text-xs">CANCEL</button>
                <button onClick={confirmDelete} disabled={deleteLoading} className="flex-1 py-3 font-bold bg-red-600 text-white border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex justify-center items-center gap-2 text-xs">
                    {deleteLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : "DELETE"}
                </button>
            </div>
          </div>
        </div>
      )}

      {selectedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="db-card w-full max-w-lg p-6 shadow-[12px_12px_0px_0px_var(--db-text)]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-lg uppercase text-(--db-text)">Link Details</h3>
                    <button onClick={() => setSelectedLink(null)} className="border-2 border-(--db-border) p-1 hover:bg-red-100 text-(--db-text)"><X className="h-5 w-5"/></button>
                </div>
                <div className="bg-(--db-bg) border-2 border-(--db-border) p-4 font-mono text-xs break-all mb-4 text-(--db-text)">
                    {selectedLink.targetUrl}
                </div>
                <div className="flex justify-end gap-2">
                    <a href={selectedLink.targetUrl} target="_blank" className="bg-(--db-primary) text-(--db-primary-fg) px-4 py-2 font-bold border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] flex gap-2 text-xs">
                        OPEN <ExternalLink className="h-4 w-4"/>
                    </a>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
