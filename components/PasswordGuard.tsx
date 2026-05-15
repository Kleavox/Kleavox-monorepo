//components/PasswordGuard.tsx

"use client";

import { useState } from "react";
import { Lock, CircleNotch, ShieldCheck, Warning, Activity } from "@phosphor-icons/react";
import SlugRedirector from "./SlugRedirector";

export default function PasswordGuard({ slug }: { slug: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/links/${slug}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ACCESS_DENIED");
      setTargetUrl(data.targetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "VERIFICATION_FAILED");
      setLoading(false);
    }
  }

  if (targetUrl) {
    return (
      <div className="w-full space-y-6 animate-reveal">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-(--db-primary)/15 text-(--db-primary) rounded-2xl">
            <ShieldCheck size={22} weight="fill" />
          </div>
          <div>
            <p className="nothing-title text-xl text-(--db-text)">ACCESS_GRANTED</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Activity size={12} className="text-(--db-primary) animate-pulse" />
              <span className="nothing-label text-[9px] text-(--db-primary) opacity-100">CLEARANCE_CONFIRMED</span>
            </div>
          </div>
        </div>
        <SlugRedirector target={targetUrl} delay={2} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <div className="space-y-2">
        <label className="nothing-label block ml-1 text-[9px]">Security_Key</label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
            <Lock size={18} />
          </div>
          <input
            type="password"
            className="db-input pl-10!"
            placeholder="Enter access key"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            required
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 text-red-500 font-bold p-3 rounded-2xl border border-red-500/20 text-[10px] animate-error-shake flex items-center gap-3 uppercase tracking-widest">
          <Warning size={16} weight="fill" className="shrink-0" /> {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full py-4 text-xs tracking-[0.2em] shadow-lg shadow-(--db-primary)/20 disabled:opacity-40"
      >
        {loading ? <CircleNotch size={18} className="animate-spin" /> : <><Lock size={16} /> UNLOCK_NODE</>}
      </button>
    </form>
  );
}
