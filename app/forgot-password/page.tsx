//app/forgot-password/page.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleNotch, Envelope, ArrowLeft, Key, CheckCircle, Warning } from "@phosphor-icons/react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performReset() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performReset();
  }

  if (success) {
    return (
      <div className="db-card w-full max-w-md p-10 text-center animate-reveal shadow-2xl border-(--db-border)">
        <div className="inline-flex p-6 bg-(--db-primary)/15 text-(--db-primary) rounded-3xl mb-8">
          <CheckCircle size={44} weight="fill" />
        </div>
        <div className="space-y-3 mb-10">
          <p className="nothing-label text-(--db-primary) opacity-100">DISPATCH_SENT</p>
          <h2 className="nothing-title text-2xl text-(--db-text)">CHECK_YOUR_INBOX</h2>
          <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px] leading-relaxed max-w-xs mx-auto">
            Sent to: {email}. If that email exists in our system, reset instructions have been dispatched.
          </p>
        </div>
        <Link href="/" className="btn-primary w-full py-4 text-xs tracking-[0.2em] shadow-lg shadow-(--db-primary)/20">
          RETURN_TO_SYSTEM
        </Link>
      </div>
    );
  }

  return (
    <div className="db-card w-full max-w-md p-8 sm:p-10 shadow-2xl animate-reveal border-(--db-border)">
      <div className="flex items-center gap-4 mb-8 border-b border-(--db-border)/30 pb-6">
        <div className="bg-(--db-primary)/15 p-3 rounded-2xl shrink-0">
          <Key size={22} className="text-(--db-primary)" />
        </div>
        <div>
          <h1 className="nothing-title text-xl text-(--db-text)">RECOVER_ACCESS</h1>
          <p className="nothing-label text-[9px] opacity-50">Reset_Key_Protocol</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="nothing-label block ml-1 text-[9px]">Identity_Email</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
              <Envelope size={18} />
            </div>
            <input
              type="email"
              required
              className="db-input pl-10!"
              placeholder="USER@SYSTEM.NET"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-500 font-bold p-3 rounded-2xl border border-red-500/20 text-[10px] animate-error-shake flex items-center gap-3 uppercase tracking-widest">
            <Warning size={15} weight="fill" className="shrink-0" /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-4 text-xs tracking-[0.2em] shadow-lg shadow-(--db-primary)/20 disabled:opacity-40"
        >
          {loading ? <CircleNotch size={20} className="animate-spin" /> : "DISPATCH_RESET_LINK"}
        </button>
      </form>

      <div className="mt-8 text-center pt-6 border-t border-(--db-border)/30">
        <Link href="/" className="nothing-label text-[10px] hover:text-(--db-primary) flex items-center justify-center gap-2 transition-colors">
          <ArrowLeft size={13} /> BACK_TO_SYSTEM
        </Link>
      </div>
    </div>
  );
}
