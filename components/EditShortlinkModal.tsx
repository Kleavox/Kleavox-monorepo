//components/EditShortlinkModal.tsx

"use client";

import { useState } from "react";
import { X, FloppyDisk, CircleNotch, Link as LinkIcon, Lock, CalendarBlank, Warning } from "@phosphor-icons/react";
import type { ShortLink } from "./ExistingShortlinksCard";

interface EditShortlinkModalProps {
  link: ShortLink;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditShortlinkModal({ link, onClose, onUpdate }: EditShortlinkModalProps) {
  const [targetUrl, setTargetUrl] = useState(link.targetUrl);
  const [password, setPassword] = useState("");
  const defaultDate = link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "";
  const [expiresAt, setExpiresAt] = useState(defaultDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/links/${link.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          password: password || undefined,
          expiresAt: expiresAt || undefined,
          removeExpiry: expiresAt === "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update link.");
      onUpdate();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 db-overlay animate-reveal">
      <div className="db-card animate-modal-in relative w-full max-w-lg shadow-2xl">

        <div className="flex items-center justify-between px-6 py-5 border-b border-(--db-border)">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-(--db-primary)/15 text-(--db-primary) rounded-2xl">
              <LinkIcon size={18} />
            </div>
            <div>
              <h2 className="nothing-title text-xl text-(--db-text)">MODIFY_LINK</h2>
              <p className="nothing-label text-[9px] opacity-40 tracking-widest">/{link.slug}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-(--db-surface-hover) text-(--db-text) opacity-30 hover:opacity-100 transition-all group"
          >
            <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">

            <div className="flex items-center justify-between bg-(--db-surface-hover) rounded-full px-5 py-3 border border-(--db-border)">
              <span className="nothing-label text-[9px] opacity-40">Slug_Identifier</span>
              <span className="font-dot text-sm text-(--db-text) tracking-tight">/{link.slug}</span>
            </div>

            <div className="space-y-2">
              <label className="nothing-label block ml-1 text-[9px]">Destination_Target</label>
              <input
                className="db-input"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                required
                type="url"
                placeholder="https://example.com/..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="nothing-label text-[9px] block ml-1 flex items-center gap-1.5">
                  <Lock size={11} /> New_Security_Key
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
                    <Lock size={15} />
                  </div>
                  <input
                    className="db-input pl-10!"
                    placeholder="Leave blank to keep"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    type="text"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="nothing-label text-[9px] block ml-1 flex items-center gap-1.5">
                  <CalendarBlank size={11} /> Self_Destruct_Timer
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
                    <CalendarBlank size={15} />
                  </div>
                  <input
                    className="db-input pl-10!"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 text-red-500 font-bold p-3 rounded-2xl border border-red-500/20 text-[10px] animate-error-shake flex items-center gap-3 uppercase tracking-widest">
                <Warning size={15} weight="fill" className="shrink-0" /> {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1 py-3.5 text-[10px] nothing-label opacity-100">
                CANCEL
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1 py-3.5 text-xs tracking-widest shadow-lg shadow-(--db-primary)/20 disabled:opacity-40"
              >
                {loading ? <CircleNotch size={16} className="animate-spin" /> : <><FloppyDisk size={15} /> COMMIT_CHANGES</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
