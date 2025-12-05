// components/FileUploader.tsx
"use client";

import { useState } from "react";
import { UploadCloud, Loader2, X, File as FileIcon } from "lucide-react";

export default function FileUploader({ onUploadSuccess }: { onUploadSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);

    try {
      const resUrl = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: file.name, 
          type: file.type,
          size: file.size
        }),
      });

      if (!resUrl.ok) {
        const err = await resUrl.json();
        throw new Error(err.error || "Gagal inisiasi upload");
      }

      const { uploadUrl, key, expiresAt } = await resUrl.json();

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setProgress(percent);
          }
        };
        xhr.onload = () => {
          if (xhr.status === 200) resolve();
          else reject(new Error("Upload ke storage gagal"));
        };
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.send(file);
      });

      const resSave = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          name: file.name,
          type: file.type,
          size: file.size,
          expiresAt
        }),
      });

      if (!resSave.ok) throw new Error("Gagal menyimpan metadata");

      setFile(null);
      onUploadSuccess();
    } catch (error) {
      console.error("Upload failed", error);
      alert(error instanceof Error ? error.message : "Gagal mengupload file.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
      {!file ? (
        <label className="cursor-pointer flex flex-col items-center gap-2">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full text-indigo-600 dark:text-indigo-400">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div>
            <span className="font-bold text-gray-900 dark:text-gray-100">Click to upload</span> or drag and drop
          </div>
          <p className="text-xs text-gray-500">Public: Max 1GB/1h • User: Max 5GB/1d • Admin: Unlimited</p>
          <input
            type="file"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      ) : (
        <div className="w-full max-w-md mx-auto space-y-4">
          <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                <FileIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </div>
              <div className="text-left truncate">
                <p className="font-bold text-sm truncate text-gray-900 dark:text-gray-100">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            {!uploading && (
              <button onClick={() => setFile(null)} className="p-1 hover:bg-red-50 text-red-500 rounded">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {uploading ? (
            <div className="space-y-1">
              <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs font-bold text-gray-500 text-right">{progress}% Uploading...</p>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all"
            >
              Start Upload
            </button>
          )}
        </div>
      )}
    </div>
  );
}
