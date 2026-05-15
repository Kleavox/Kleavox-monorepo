//components/VerifyForm.tsx

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleNotch, ShieldCheck, CheckCircle, ArrowClockwise, Warning, Envelope, Key } from "@phosphor-icons/react";

function VerifyContent() {
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) { setEmail(emailParam); setEmailConfirmed(true); }
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setResendMessage("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setResendLoading(true); setResendMessage(""); setError(null);
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      setResendMessage("NEW_CODE_DISPATCHED");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "FAILED");
    } finally {
      setResendLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center animate-reveal w-full space-y-6">
        <div className="inline-flex p-5 bg-(--db-primary)/15 text-(--db-primary) rounded-3xl">
          <CheckCircle size={40} weight="fill" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl nothing-title text-(--db-text)">VERIFIED</h2>
          <p className="nothing-label normal-case tracking-normal text-[10px] opacity-50">
            Identity confirmed. Access granted to core systems.
          </p>
        </div>
        <button onClick={() => router.push("/")} className="btn-primary w-full py-3.5 text-xs tracking-widest">
          CONTINUE_TO_SYSTEM
        </button>
      </div>
    );
  }

  if (!emailConfirmed) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-4 mb-8 border-b border-(--db-border)/30 pb-6">
          <div className="bg-(--db-primary)/15 p-3 rounded-2xl shrink-0">
            <ShieldCheck size={22} className="text-(--db-primary)" />
          </div>
          <div>
            <h2 className="text-xl nothing-title text-(--db-text)">VERIFY</h2>
            <p className="nothing-label text-[9px]">Identity_Validation_Node</p>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (email) setEmailConfirmed(true); }} className="space-y-5">
          <div className="space-y-1.5">
            <label className="nothing-label block ml-1 text-[9px]">Target_Email</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) pointer-events-none z-10">
                <Envelope size={17} />
              </div>
              <input
                type="email"
                required
                className="db-input pl-10!"
                placeholder="USER@DOMAIN.COM"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <button type="submit" disabled={!email} className="btn-primary w-full py-3.5 text-xs tracking-widest disabled:opacity-40">
            REQUEST_ACCESS_CODE
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 mb-8 border-b border-(--db-border)/30 pb-6">
        <div className="bg-(--db-primary)/15 p-3 rounded-2xl shrink-0">
          <Key size={22} className="text-(--db-primary)" />
        </div>
        <div>
          <h2 className="text-xl nothing-title text-(--db-text)">AUTHORIZE</h2>
          <p className="nothing-label text-[9px]">Awaiting_Confirmation_Payload</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="nothing-label text-center block text-[8px] opacity-40">Sent to: {email}</label>
          <input
            className="db-input text-center text-3xl! font-dot tracking-[0.4em] py-6!"
            placeholder="000000"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </div>

        <div className="min-h-10 flex items-center justify-center">
          {error ? (
            <div className="text-red-500 font-bold text-[9px] uppercase tracking-widest flex items-center gap-2 animate-error-shake">
              <Warning size={14} weight="fill" className="shrink-0" /> {error}
            </div>
          ) : resendMessage ? (
            <div className="text-(--db-primary) font-bold text-[9px] uppercase tracking-widest flex items-center gap-2">
              <CheckCircle size={14} weight="fill" className="shrink-0" /> {resendMessage}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={loading || otp.length < 6}
          className="btn-primary w-full py-3.5 text-xs tracking-widest shadow-lg shadow-(--db-primary)/20 disabled:opacity-40"
        >
          {loading ? <CircleNotch size={20} className="animate-spin" /> : "CONFIRM_PAYLOAD"}
        </button>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resendLoading}
            className="nothing-label text-[9px] hover:text-(--db-text) flex items-center justify-center gap-2 mx-auto transition-colors disabled:opacity-40"
          >
            {resendLoading ? <CircleNotch size={12} className="animate-spin" /> : <ArrowClockwise size={12} />}
            {cooldown > 0 ? `RESEND_AVAILABLE_IN_${cooldown}S` : "RESEND_DISPATCH_CODE"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function VerifyForm() {
  return (
    <Suspense fallback={<div className="text-center p-10 nothing-label animate-pulse text-[9px]">BOOTING_VALIDATOR_NODE...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
