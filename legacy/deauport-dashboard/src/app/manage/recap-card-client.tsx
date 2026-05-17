"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { useConfirm } from "@/components/confirm";
import { useToast } from "@/components/toast";
import { triggerManualBackupAction } from "./actions";

export function RecapCard() {
  const confirm = useConfirm();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function handleInitiateBackup() {
    const ok = await confirm({
      title: "Kirim Backup Manual?",
      message: "Ini akan mengirim backup seluruh data saat ini ke email admin. Tidak ada data yang akan dihapus atau direset.",
      confirmText: "Ya, Kirim",
      tone: "default",
    });

    if (!ok) return;

    setLoading(true);
    try {
      await triggerManualBackupAction();
      toast("Email backup telah berhasil dikirim!");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Gagal mengirim backup.";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-medium">Manual Backup</h3>
          <p className="mt-1 text-sm text-subtle">
            Buat dan kirim backup seluruh data saat ini ke email.
          </p>
        </div>
        <button 
          className="btn btn-primary w-28 text-center"
          onClick={handleInitiateBackup}
          disabled={loading}
        >
          {loading ? "..." : "Backup"} 
        </button>
      </div>
    </Card>
  );
}