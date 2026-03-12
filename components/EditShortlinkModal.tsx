//components/EditShortlinkModal.tsx

"use client";

import { useState } from "react";
import { X, Save, Loader2, Link2, Lock, Calendar } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="db-card w-full max-w-lg p-6 shadow-[12px_12px_0px_0px_var(--db-border)]">
        
        <div className="flex items-center justify-between border-b-4 border-(--db-border) pb-4 mb-6">
          <h2 className="text-xl font-black uppercase flex items-center gap-2 text-(--db-text)">
            <Link2 className="h-6 w-6" /> EDIT LINK
          </h2>
          <button onClick={onClose} className="border-2 border-(--db-border) p-1 hover:bg-red-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            <div className="bg-(--db-bg) p-3 border-2 border-(--db-border) flex items-center justify-between">
                <span className="font-bold text-xs text-(--db-text-muted) uppercase">Slug</span>
                <span className="font-black text-sm font-mono text-(--db-text)">/{link.slug}</span>
            </div>

            <div className="space-y-1">
                <label className="font-black text-xs uppercase text-(--db-text-muted)">Target URL</label>
                <input 
                    className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all"
                    value={targetUrl}
                    onChange={e => setTargetUrl(e.target.value)}
                    required
                    type="url"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="font-black text-xs uppercase text-(--db-text-muted) flex items-center gap-1"><Lock className="h-3 w-3"/> New Password</label>
                    <input 
                        className="w-full bg-(--db-bg) border-2 border-(--db-border) p-2 text-sm font-medium focus:outline-none focus:shadow-[2px_2px_0px_0px_var(--db-border)]"
                        placeholder="Leave blank to keep"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="new-password"
                        type="text"
                    />
                </div>
                <div className="space-y-1">
                    <label className="font-black text-xs uppercase text-(--db-text-muted) flex items-center gap-1"><Calendar className="h-3 w-3"/> Expiry</label>
                    <input 
                        className="w-full bg-(--db-bg) border-2 border-(--db-border) p-2 text-sm font-medium focus:outline-none focus:shadow-[2px_2px_0px_0px_var(--db-border)]"
                        type="datetime-local"
                        value={expiresAt}
                        onChange={e => setExpiresAt(e.target.value)}
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-100 border-2 border-(--db-border) text-red-600 p-3 text-xs font-bold text-center">
                    {error}
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-3 font-bold border-2 border-(--db-border) text-(--db-text) hover:bg-(--db-bg)">CANCEL</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 font-bold bg-(--db-primary) text-white border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <><Save className="h-4 w-4"/> SAVE CHANGES</>}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}
