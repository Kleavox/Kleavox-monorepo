//components/LoginForm.tsx

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CircleNotch, Eye, EyeSlash, Warning, Key, Envelope } from "@phosphor-icons/react";
import type { LoginResponse } from "@/types";

interface LoginFormProps {
  nextPath?: string;
}

export default function LoginForm({ nextPath = "/dash" }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState<number | null>(null);

  useEffect(() => {
    if (cooldown === null) return;
    if (cooldown <= 0) { setCooldown(null); return; }
    const id = setInterval(() => setCooldown((prev) => (prev === null || prev <= 1 ? null : prev - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function performLogin() {
    setLoading(true); setError(null); setUnverified(false);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data: LoginResponse = await res.json().catch(() => ({}));

      if (res.status === 429) {
        const retry = typeof data.retryAfter === "number" ? data.retryAfter : 60;
        setCooldown(retry);
        setError(`Too many attempts. Wait ${retry}s.`);
        return;
      }
      if (res.status === 403) { setUnverified(true); return; }
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Login failed");

      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cooldown !== null && cooldown > 0) return;
    await performLogin();
  }

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center gap-4 mb-8 border-b border-(--db-border) pb-6">
        <div className="bg-(--db-primary)/15 p-3 rounded-2xl shrink-0">
          <Key size={22} className="text-(--db-primary)" />
        </div>
        <div>
          <h2 className="text-xl nothing-title text-(--db-text)">AUTHORIZE</h2>
          <p className="nothing-label text-[10px] text-(--db-text) opacity-50">SECURE_NODE_ACCESS</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="nothing-label block ml-1 text-[10px] text-(--db-text) font-bold">IDENTITY_EMAIL</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
              <Envelope size={18} />
            </div>
            <input
              type="email"
              className="db-input pl-10!"
              placeholder="USER@SYSTEM.NET"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-end px-1">
            <label className="nothing-label block text-[10px] text-(--db-text) font-bold">ACCESS_KEY</label>
            <Link href="/forgot-password" className="text-[9px] font-black text-(--db-primary) hover:underline uppercase tracking-widest">
              Lost?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) z-10 pointer-events-none">
              <Key size={18} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              className="db-input pl-10! pr-12!"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-(--db-text) opacity-40 hover:opacity-100 transition-all"
              disabled={loading}
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || (cooldown !== null && cooldown > 0)}
          className="btn-primary w-full py-4 text-xs tracking-[0.2em] mt-2 shadow-lg shadow-(--db-primary)/20 disabled:opacity-40"
        >
          {loading ? (
            <CircleNotch size={20} className="animate-spin" />
          ) : cooldown ? (
            `WAIT_${cooldown}S`
          ) : (
            "AUTHORIZE_SYSTEM"
          )}
        </button>

        {error && (
          <div className="bg-red-500/10 text-red-500 font-bold p-3 rounded-2xl border border-red-500/20 text-[10px] animate-error-shake flex items-center gap-3 uppercase tracking-widest">
            <Warning size={16} weight="fill" className="shrink-0" /> {error}
          </div>
        )}

        {unverified && (
          <div className="flex flex-col items-center gap-3 bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
            <p className="nothing-label text-amber-600 text-[8px] font-bold uppercase">Action_Required: Verify</p>
            <Link
              href={`/verify?email=${encodeURIComponent(email)}`}
              className="btn-secondary w-full py-2 text-[9px] border-amber-500/30 text-amber-700 font-black"
            >
              VERIFY_NOW
            </Link>
          </div>
        )}
      </form>

      <div className="mt-8 text-center pt-6 border-t border-(--db-border)">
        <span className="nothing-label text-[10px] text-(--db-text) opacity-50 mr-2 uppercase">New_User?</span>
        <Link href="/register" className="nothing-label text-[10px] text-(--db-primary) font-black border-b border-transparent hover:border-(--db-primary) transition-all">
          CREATE_IDENTITY
        </Link>
      </div>
    </div>
  );
}
