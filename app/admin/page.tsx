// app/admin/page.tsx

"use client";

import { useEffect, useState } from "react";
import UserMenu from "@/components/UserMenu";
import { 
    Users, Link2, AlertTriangle, 
    Trash2, ExternalLink, Loader2, RefreshCw, ShieldAlert 
} from "lucide-react";

interface AdminData {
    reports: {
        id: string;
        reason: string;
        details: string;
        shortLink: {
            slug: string;
            targetUrl: string;
        } | null;
    }[];
    publicLinks: {
        id: string;
        slug: string;
        targetUrl: string;
    }[];
    stats: {
        totalUsers: number;
        totalLinks: number;
        pendingReports: number;
    };
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"reports" | "public">("reports");
  
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; slug: string | null }>({ show: false, slug: null });
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [userEmail, setUserEmail] = useState("Admin");
  const [userRole, setUserRole] = useState("ADMIN");

  useEffect(() => {
    fetchSession();
    fetchData();
  }, []);

  async function fetchSession() {
    try {
        const res = await fetch("/api/session");
        const session = await res.json();
        if(session.user) {
            setUserEmail(session.user.email);
            setUserRole(session.user.role);
            if(session.user.role !== "ADMIN") window.location.href = "/dash";
        } else {
            window.location.href = "/";
        }
    } catch {}
  }

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/data");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setData(json);
    } catch { } finally {
      setLoading(false);
    }
  }

  function confirmDelete(slug: string) {
    setDeleteModal({ show: true, slug });
  }

  async function executeDelete() {
    if (!deleteModal.slug) return;
    setIsDeleting(true);
    try {
        const res = await fetch(`/api/links/${deleteModal.slug}`, { method: "DELETE" });
        if(res.ok) {
            setDeletingSlug(deleteModal.slug);
            setDeleteModal({ show: false, slug: null });
            
            
            await new Promise(resolve => setTimeout(resolve, 400));
            
            setDeletingSlug(null);
            fetchData();
        } else {
            alert("Failed to delete");
        }
    } catch {
        alert("Error");
    } finally {
        setIsDeleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-(--db-bg) pb-20 font-sans">
      
      <header className="bg-(--db-text) border-b-4 border-red-600 p-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className="bg-red-600 p-2 border-2 border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                    <ShieldAlert className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-black uppercase text-white tracking-widest leading-none">Command Center</h1>
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-[0.2em]">Root Access Granted</p>
                </div>
            </div>
            
            <div>
                <UserMenu username={userEmail} role={userRole} />
            </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="db-card-admin relative p-6 overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-xs font-black uppercase tracking-widest text-(--db-text-muted) mb-1">Registered Users</p>
                    <p className="text-4xl font-black text-(--db-text)">{data?.stats.totalUsers || 0}</p>
                </div>
                <Users className="absolute -right-4 -bottom-4 h-24 w-24 text-(--db-border) opacity-10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="db-card-admin relative p-6 overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-xs font-black uppercase tracking-widest text-(--db-text-muted) mb-1">Active Links</p>
                    <p className="text-4xl font-black text-(--db-text)">{data?.stats.totalLinks || 0}</p>
                </div>
                <Link2 className="absolute -right-4 -bottom-4 h-24 w-24 text-(--db-border) opacity-10 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="db-card-admin relative bg-red-600 p-6 overflow-hidden group">
                <div className="relative z-10">
                    <p className="text-xs font-black uppercase tracking-widest text-red-200 mb-1">Abuse Reports</p>
                    <p className="text-4xl font-black text-white">{data?.stats.pendingReports || 0}</p>
                </div>
                <AlertTriangle className="absolute -right-4 -bottom-4 h-24 w-24 text-black opacity-20 group-hover:scale-110 transition-transform duration-500" />
            </div>
        </div>

        <div className="db-card-admin flex flex-col min-h-150">
            <div className="flex flex-col sm:flex-row border-b-4 border-(--db-border)">
                <div className="flex flex-1">
                    <button 
                        onClick={() => setActiveTab("reports")}
                        className={`flex-1 py-4 px-6 font-black uppercase text-sm flex items-center justify-center gap-2 transition-all border-r-4 border-(--db-border) ${activeTab === "reports" ? "bg-red-100 text-red-700 shadow-[inset_0px_0px_10px_rgba(0,0,0,0.1)]" : "hover:bg-(--db-bg)"}`}
                    >
                        <AlertTriangle className="h-4 w-4"/> 
                        <span>Reports <span className="ml-2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded">{data?.reports.length || 0}</span></span>
                    </button>
                    <button 
                        onClick={() => setActiveTab("public")}
                        className={`flex-1 py-4 px-6 font-black uppercase text-sm flex items-center justify-center gap-2 transition-all border-r-4 border-(--db-border) ${activeTab === "public" ? "bg-blue-100 text-blue-700 shadow-[inset_0px_0px_10px_rgba(0,0,0,0.1)]" : "hover:bg-(--db-bg)"}`}
                    >
                        <Link2 className="h-4 w-4"/> 
                        <span>Public Links <span className="ml-2 bg-black text-white text-[10px] px-1.5 py-0.5 rounded">{data?.publicLinks.length || 0}</span></span>
                    </button>
                </div>
                <button 
                    onClick={fetchData} 
                    className="py-4 px-8 hover:bg-(--db-bg) hover:rotate-180 transition-all duration-500 bg-(--db-surface)" 
                    title="Force Refresh"
                >
                    <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            <div className="flex-1 overflow-x-auto bg-(--db-bg) p-4">
                {loading && !data ? (
                    <div className="h-full flex flex-col items-center justify-center p-10 opacity-50">
                        <Loader2 className="h-12 w-12 animate-spin text-(--db-text) mb-4"/>
                        <p className="font-bold text-xs uppercase tracking-widest">Fetching Data...</p>
                    </div>
                ) : (
                    <div className="min-w-[600px]">
                        <table className="w-full text-left border-collapse border-2 border-(--db-border) bg-(--db-surface)">
                            <thead className="bg-(--db-text) text-(--db-bg) sticky top-0 z-10 shadow-md">
                                <tr>
                                    <th className="p-4 text-xs font-black uppercase tracking-wider border-b-4 border-r-2 border-(--db-border)">Slug Identity</th>
                                    <th className="p-4 text-xs font-black uppercase tracking-wider border-b-4 border-r-2 border-(--db-border) w-1/3">Target Destination</th>
                                    {activeTab === "reports" && <th className="p-4 text-xs font-black uppercase tracking-wider border-b-4 border-r-2 border-(--db-border)">Flag Reason</th>}
                                    <th className="p-4 text-xs font-black uppercase tracking-wider border-b-4 border-(--db-border) text-right">Protocol</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-(--db-border)">
                                {activeTab === "reports" ? (
                                    data?.reports.map((report) => (
                                        <tr key={report.id} className={`hover:bg-red-50 transition-colors group ${report.shortLink?.slug === deletingSlug ? "animate-shrink-out pointer-events-none" : ""}`}>
                                            <td className="p-4 border-r-2 border-(--db-border)">
                                                {report.shortLink ? (
                                                    <div className="font-mono font-bold text-sm bg-(--db-bg) inline-block px-2 py-1 border border-(--db-border)">/{report.shortLink.slug}</div>
                                                ) : (
                                                    <span className="text-red-400 italic font-bold line-through">DELETED</span>
                                                )}
                                            </td>
                                            <td className="p-4 border-r-2 border-(--db-border)">
                                                <div className="text-xs font-medium truncate max-w-[200px] lg:max-w-[400px] text-(--db-text-muted) font-mono">
                                                    {report.shortLink?.targetUrl || "N/A"}
                                                </div>
                                            </td>
                                            <td className="p-4 border-r-2 border-(--db-border)">
                                                <div className="flex flex-col gap-1">
                                                    <span className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 uppercase w-fit">
                                                        {report.reason}
                                                    </span>
                                                    <span className="text-[10px] text-(--db-text) italic">&quot;{report.details}&quot;</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                {report.shortLink && (
                                                    <button 
                                                        onClick={() => confirmDelete(report.shortLink!.slug)}
                                                        className="bg-red-600 text-white p-2 border-2 border-black shadow-[2px_2px_0px_0px_black] hover:translate-y-0.5 hover:shadow-none transition-all"
                                                        title="Destroy Link"
                                                    >
                                                        <Trash2 className="h-4 w-4"/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    data?.publicLinks.map((link) => (
                                        <tr key={link.id} className={`hover:bg-blue-50 transition-colors group ${link.slug === deletingSlug ? "animate-shrink-out pointer-events-none" : ""}`}>
                                            <td className="p-4 border-r-2 border-(--db-border)">
                                                <div className="font-mono font-bold text-sm bg-(--db-bg) inline-block px-2 py-1 border border-(--db-border)">/{link.slug}</div>
                                            </td>
                                            <td className="p-4 border-r-2 border-(--db-border)">
                                                <div className="text-xs font-medium truncate max-w-[300px] lg:max-w-[600px] flex items-center gap-1">
                                                    <a href={link.targetUrl} target="_blank" className="hover:text-blue-600 hover:underline truncate">
                                                        {link.targetUrl}
                                                    </a>
                                                    <ExternalLink className="h-3 w-3 opacity-50 shrink-0"/>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button 
                                                    onClick={() => confirmDelete(link.slug)}
                                                    className="bg-(--db-surface) text-red-600 p-2 border-2 border-(--db-border) hover:bg-red-600 hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)]"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4"/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            
                            {(activeTab === "reports" && data?.reports.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="p-12 text-center">
                                        <div className="inline-block p-4 bg-green-100 border-4 border-green-200 rounded-full mb-2">
                                            <ShieldAlert className="h-8 w-8 text-green-600" />
                                        </div>
                                        <p className="font-bold text-(--db-text-muted) uppercase">System Clean. No Reports.</p>
                                    </td>
                                </tr>
                            )}
                            {(activeTab === "public" && data?.publicLinks.length === 0) && (
                                <tr>
                                    <td colSpan={3} className="p-12 text-center">
                                        <p className="font-bold text-(--db-text-muted) uppercase">Database Empty.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    </div>
</div>

      {deleteModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
           <div className="w-full max-w-sm bg-red-600 border-4 border-white p-1 shadow-[0px_0px_50px_rgba(220,38,38,0.5)] animate-in zoom-in-95">
              <div className="bg-(--db-surface) border-4 border-(--db-border) p-6 text-center">
                  <div className="flex justify-center mb-4">
                     <div className="bg-red-600 text-white p-3 border-4 border-(--db-border) rounded-full animate-warning-glow">
                        <Trash2 className="h-8 w-8" />
                     </div>
                  </div>
                  <h2 className="text-2xl font-black uppercase leading-none text-(--db-text) mb-2">TERMINATE LINK?</h2>
                  <div className="bg-(--db-bg) p-3 border-2 border-(--db-border) mb-6">
                      <p className="font-mono font-bold text-sm text-(--db-text)">/{deleteModal.slug}</p>
                  </div>
                  <p className="font-bold text-(--db-text-muted) text-xs mb-6 px-4">
                      This action will permanently purge the link record from the database and invalidate the cache.
                  </p>

                  <div className="flex flex-col gap-3">
                     <button 
                        onClick={executeDelete}
                        disabled={isDeleting}
                        className="w-full py-4 font-black bg-red-600 text-white border-4 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)] hover:translate-y-0.5 hover:shadow-none transition-all uppercase flex justify-center items-center gap-2 text-sm"
                     >
                        {isDeleting ? <Loader2 className="animate-spin h-5 w-5"/> : "CONFIRM DESTRUCTION"}
                     </button>
                     <button 
                        onClick={() => setDeleteModal({ show: false, slug: null })}
                        className="w-full py-3 font-bold border-2 border-(--db-border) text-(--db-text) hover:bg-(--db-bg) uppercase text-xs"
                     >
                        ABORT ACTION
                     </button>
                  </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
}
