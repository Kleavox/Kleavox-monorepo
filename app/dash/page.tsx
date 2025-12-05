//app/dash/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "@/components/FileUploader";
import { 
  Download, FileText, HardDrive, LogOut, Loader2, 
  UserPlus, Trash2, QrCode, Link as LinkIcon, ShieldCheck, User, MailCheck
} from "lucide-react";

interface FileData {
  id: string;
  name: string;
  size: string;
  createdAt: string;
  key: string;
  uploadedBy: string;
  expiresAt: string | null;
}

interface StatsData {
  usedGB: string;
  limitGB: number;
  percent: string;
  userCount?: number;
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [role, setRole] = useState<"ADMIN" | "USER" | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const router = useRouter();

  async function loadData() {
    setLoading(true);
    try {
      const resFiles = await fetch("/api/files");
      if (resFiles.status === 401) return router.push("/");
      const dataFiles = await resFiles.json();
      setFiles(Array.isArray(dataFiles) ? dataFiles : []);

      const resStats = await fetch("/api/admin/stats");
      if (resStats.ok) {
        setRole("ADMIN");
        const dataStats = await resStats.json();
        setStats(dataStats.storage);
      } else {
        setRole("USER");
        const totalSize = (Array.isArray(dataFiles) ? dataFiles : []).reduce((acc: number, f: any) => acc + Number(f.size), 0);
        const gb = totalSize / (1024 * 1024 * 1024);
        setStats({
          usedGB: gb.toFixed(2),
          limitGB: 5,
          percent: ((gb / 5) * 100).toFixed(1)
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  async function handleDownload(key: string, filename: string) {
    try {
      const res = await fetch(`/api/download?key=${encodeURIComponent(key)}`);
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch { alert("Error generating link"); }
  }

  async function handleDelete(id: string, key: string) {
    if(!confirm("Are you sure you want to delete this file?")) return;
    try {
      const res = await fetch(`/api/files?id=${id}&key=${encodeURIComponent(key)}`, { method: "DELETE" });
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
        loadData();
      } else {
        alert("Gagal menghapus file.");
      }
    } catch { alert("Error deleting file"); }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setIsInviting(true);
    setInviteSuccess(null);

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setInviteSuccess(inviteEmail);
        setInviteEmail("");
        setTimeout(() => setInviteSuccess(null), 5000);
      } else {
        alert(data.error || "Gagal mengundang user");
      }
    } catch (error) {
      alert("Terjadi kesalahan koneksi");
    } finally {
      setIsInviting(false);
    }
  }

  const copyLink = async (key: string) => {
    const res = await fetch(`/api/download?key=${encodeURIComponent(key)}`);
    const { url } = await res.json();
    navigator.clipboard.writeText(url);
    alert("Link copied!");
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${role === 'ADMIN' ? 'bg-indigo-600' : 'bg-emerald-600'} text-white shadow-lg`}>
              {role === 'ADMIN' ? <ShieldCheck className="w-8 h-8" /> : <User className="w-8 h-8" />}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                DeauVault <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 dark:bg-gray-800 rounded-full uppercase tracking-wide">{role}</span>
              </h1>
              <p className="text-gray-500 text-sm font-medium">Secure Storage Management</p>
            </div>
          </div>

          {stats && (
            <div className="flex-1 max-w-xs bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between text-xs font-bold mb-2 text-gray-500 uppercase tracking-wider">
                <span>Storage Usage</span>
                <span>{stats.usedGB} / {stats.limitGB} GB</span>
              </div>
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full transition-all duration-500 ${role === 'ADMIN' ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(Number(stats.percent), 100)}%` }}></div>
              </div>
            </div>
          )}

          <button onClick={handleLogout} className="self-start md:self-center px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {role === "ADMIN" && (
          <div className="bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-4 transition-all">
            <div className="flex-1">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Invite New User
              </h3>
              <p className="text-sm text-indigo-700 dark:text-indigo-400 mt-1">Send an invitation email with activation link.</p>
            </div>
            
            {inviteSuccess ? (
              <div className="flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-4 py-2 rounded-lg animate-in fade-in slide-in-from-right">
                <MailCheck className="w-5 h-5" />
                <span className="text-sm font-bold">Email sent to {inviteSuccess}!</span>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="flex gap-2 w-full md:w-auto">
                <input 
                  type="email" 
                  placeholder="User email address..." 
                  className="flex-1 md:w-64 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
                <button disabled={isInviting} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-2">
                  {isInviting && <Loader2 className="w-4 h-4 animate-spin" />} Invite
                </button>
              </form>
            )}
          </div>
        )}

        <FileUploader onUploadSuccess={loadData} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <HardDrive className="w-5 h-5" /> My Files <span className="bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded-full text-xs">{files.length}</span>
            </h2>
            <button onClick={loadData} className="text-xs font-bold text-indigo-600 hover:underline">Refresh</button>
          </div>

          {files.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl text-gray-400 font-medium">
              No files uploaded yet.
            </div>
          ) : (
            <div className="grid gap-4">
              {files.map((file) => (
                <div key={file.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate text-gray-900 dark:text-gray-100">{file.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                        <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 rounded">{(Number(file.size) / 1024 / 1024).toFixed(2)} MB</span>
                        <span>• {new Date(file.createdAt).toLocaleDateString()}</span>
                        {role === "ADMIN" && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">• Uploaded by: {file.uploadedBy}</span>
                        )}
                        {file.expiresAt && <span className="text-orange-500">• Exp: {new Date(file.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <button onClick={() => copyLink(file.key)} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" title="Copy Link">
                      <LinkIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://${window.location.host}/api/download?key=${file.key}`)}`, '_blank')} className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" title="Generate QR">
                      <QrCode className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDownload(file.key, file.name)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg" title="Download">
                      <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(file.id, file.key)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
