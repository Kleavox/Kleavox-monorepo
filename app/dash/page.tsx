//app/dash/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FileUploader from "@/components/FileUploader";
import { Download, FileText, HardDrive, LogOut, Loader2 } from "lucide-react";

interface FileData {
  id: string;
  name: string;
  size: string;
  createdAt: string;
  key: string;
}

export default function DashboardPage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function fetchFiles() {
    setLoading(true);
    try {
      const res = await fetch("/api/files");
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setFiles(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFiles();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handleDownload(key: string, filename: string) {
    try {
      const res = await fetch(`/api/download?key=${encodeURIComponent(key)}`);
      const { url } = await res.json();
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert("Gagal membuat link download.");
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between border-b pb-6 border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <HardDrive className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">DeauVault</h1>
              <p className="text-gray-500 text-sm font-medium">Secure File Management</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-900/50"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        <FileUploader onUploadSuccess={fetchFiles} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Stored Files <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-400">{files.length}</span>
            </h2>
            <button onClick={fetchFiles} className="text-xs font-bold text-indigo-600 hover:underline">
              Refresh List
            </button>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 animate-pulse">
              <Loader2 className="w-8 h-8 mb-2 animate-spin" />
              <p className="text-sm font-medium">Syncing data...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
              <p className="text-gray-400 font-medium">Vault is empty.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {files.map((file) => (
                <div key={file.id} className="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 rounded-xl flex items-center justify-between hover:border-indigo-500 transition-all shadow-sm hover:shadow-md">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 transition-colors">
                      <FileText className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 dark:text-gray-500 dark:group-hover:text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate pr-4 text-sm md:text-base">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 rounded">{(Number(file.size) / 1024 / 1024).toFixed(2)} MB</span>
                        <span>•</span>
                        <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleDownload(file.key, file.name)}
                    className="p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Download File"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
