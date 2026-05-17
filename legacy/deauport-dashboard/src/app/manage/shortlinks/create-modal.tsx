"use client";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast";
import { createShortlinkAction } from "../actions";

export function CreateShortModal({
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
    const slug = String(form.get("slug") ?? "").trim();
    const targetUrl = String(form.get("targetUrl") ?? "").trim();
    try {
      setLoading(true);
      await createShortlinkAction({ slug, targetUrl });
      toast("Shortlink created");
      onClose();
      afterCreate?.();
      window.dispatchEvent(new CustomEvent("reload-shortlinks"));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create shortlink";
      toast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="text-base font-semibold">Create Shortlink</h3>
      <p className="mt-1 text-sm text-subtle">Buat slug pendek untuk URL target.</p>
      <form action={onCreate} className="mt-4 grid gap-2 sm:grid-cols-[180px,1fr,120px]">
        <div className="flex items-center">
          <span className="rounded-l-md border border-r-0 border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm text-neutral-500">
            /
          </span>
          <input name="slug" placeholder="my-slug" className="input rounded-l-none" required />
        </div>
        <input name="targetUrl" placeholder="https://target.example" className="input" required />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn">Cancel</button>
          <button className="btn btn-primary" disabled={loading}>{loading ? "Saving…" : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
}