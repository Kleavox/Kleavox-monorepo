//compnents/PasswordGuard.tsx

"use client";
import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";
import SlugRedirector from "./SlugRedirector";

export default function PasswordGuard({ slug }: { slug: string }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch(`/api/links/${slug}/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Access Denied");
      setTargetUrl(data.targetUrl);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); setLoading(false); }
  }

  if (targetUrl) {
    return (
      <div className="text-center space-y-6">
        <div className="inline-block p-4 bg-(--db-success) border-4 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)] text-white rounded-full">
           <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-black uppercase text-(--db-text)">ACCESS GRANTED</h1>
        <SlugRedirector target={targetUrl} delay={2} />
      </div>
    );
  }

  return (
    <div className="w-full text-center space-y-6">
      <div className="inline-flex h-16 w-16 items-center justify-center bg-(--db-bg) border-4 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)]">
        <Lock className="h-8 w-8 text-(--db-text)" />
      </div>
      <div>
        <h1 className="text-2xl font-black uppercase text-(--db-text)">LOCKED LINK</h1>
        <p className="text-sm font-bold text-(--db-text-muted) uppercase tracking-widest">Password Required</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xs mx-auto">
        <input
          type="password"
          className="w-full bg-(--db-bg) border-4 border-(--db-border) px-4 py-3 text-center font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:text-(--db-text-muted)"
          placeholder="ENTER PASSWORD"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="bg-(--db-danger) text-white font-bold p-2 border-2 border-(--db-border) text-xs uppercase">{error}</div>}
        <button type="submit" disabled={loading} className="w-full bg-(--db-primary) text-(--db-primary-fg) border-4 border-(--db-border) py-3 font-black uppercase shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--db-border)] active:translate-y-0 transition-all">
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "UNLOCK"}
        </button>
      </form>
    </div>
  );
}
