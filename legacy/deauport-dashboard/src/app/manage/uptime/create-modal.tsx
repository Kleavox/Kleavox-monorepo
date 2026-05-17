"use client";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { createCheckAction } from "../actions";

export function CreateUptimeModal({
  open,
  onClose,
  afterCreate,
}: {
  open: boolean;
  onClose: () => void;
  afterCreate?: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function onCreate(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const targetUrl = String(form.get("targetUrl") ?? "").trim();
    const intervalSec = Number(form.get("intervalSec") ?? 60);
    try {
      setLoading(true);
      await createCheckAction({ name, targetUrl, intervalSec });
      toast("Uptime check created");
      onClose();
      afterCreate?.();
      window.dispatchEvent(new CustomEvent("reload-uptime"));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create check";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-base font-semibold">Create Check</h3>
      <p className="mt-1 text-sm text-subtle">Tambahkan endpoint yang ingin dipantau.</p>
      <form action={onCreate} className="mt-4 grid gap-2 sm:grid-cols-[1fr,1.5fr,140px,120px]">
        <input name="name" placeholder="Name (unique)" className="input" required />
        <input name="targetUrl" placeholder="https://example.com" className="input" required />
        <input name="intervalSec" type="number" min={10} defaultValue={60} className="input" />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
}