"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui";
import { useToast } from "@/components/toast";
import { importDataAction } from "./actions";
import { useConfirm } from "@/components/confirm";

export function ImportCard() {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setFileName(file ? file.name : "");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!fileInputRef.current?.files?.length) {
      toast("Please select a file to import.", "error");
      return;
    }
    
    const ok = await confirm({
      title: "Konfirmasi Impor Data?",
      message: "Ini akan MENGHAPUS seluruh data yang ada saat ini dan menggantinya dengan data dari file backup. Tindakan ini tidak dapat dibatalkan.",
      confirmText: "Ya, Timpa dan Impor",
      tone: "danger"
    });

    if (!ok) return;

    setLoading(true);
    const formData = new FormData(formRef.current!); 
    
    try {
      const result = await importDataAction(formData);
      toast(result.message || "Impor berhasil!");
      if(fileInputRef.current) fileInputRef.current.value = "";
      setFileName("");
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("reload-uptime"));
        window.dispatchEvent(new CustomEvent("reload-shortlinks"));
      }, 500);

    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal mengimpor data.";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h3 className="font-medium">Impor Konfigurasi</h3>
      <p className="mt-1 mb-4 text-sm text-subtle">
        Pulihkan konfigurasi dari file backup `.json`. Ini akan menimpa seluruh data yang ada.
      </p>
      <form ref={formRef} onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center border border-[var(--border)] rounded-md px-2 py-1.5 text-sm bg-[var(--surface-2)]">
          <label 
            htmlFor="file-upload" 
            className="cursor-pointer bg-[var(--surface)] hover:bg-[var(--surface-3)] text-[var(--text)] font-medium px-3 py-1 rounded-md transition-colors duration-200 ease-in-out mr-2 border border-[var(--border)]"
          >
            Pilih File
          </label>
          <span className="truncate text-subtle">{fileName || "Belum ada file"}</span>
          <input
            id="file-upload"
            ref={fileInputRef}
            type="file"
            name="file"
            className="hidden"
            accept=".json"
            onChange={handleFileChange}
            disabled={loading}
          />
        </div>
        <button 
          type="submit"
          className="btn btn-primary"
          disabled={loading || !fileName}
        >
          {loading ? "..." : "Impor"}
        </button>
      </form>
    </Card>
  );
}