//components/VerifyForm.tsx

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, CheckCircle2, RefreshCw, AlertCircle, Mail, KeyRound } from "lucide-react";

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
    if (emailParam) {
      setEmail(emailParam);
      setEmailConfirmed(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResendMessage("");

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
    
    setResendLoading(true);
    setResendMessage("");
    setError(null);

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
      <div className="text-center animate-reveal w-full">
         <div className="inline-flex p-5 bg-green-500/10 text-green-500 rounded-3xl mb-6">
             <CheckCircle2 className="h-10 w-10" />
         </div>
         <h2 className="text-2xl nothing-title text-(--db-text) mb-3">VERIFIED</h2>
         <p className="nothing-label mb-8 normal-case tracking-normal text-[10px]">
            Identity confirmed. Access granted to core systems.
         </p>
         
         <button 
            onClick={() => router.push("/")}
            className="btn-primary w-full py-3.5 text-xs tracking-widest"
         >
            CONTINUE_TO_SYSTEM
         </button>
      </div>
    );
  }

  if (!emailConfirmed) {
    return (
      <div className="w-full">
        <div className="flex items-center gap-4 mb-8 border-b border-(--db-border)/30 pb-6">
            <div className="bg-(--db-primary)/10 p-3 rounded-2xl shrink-0">
                <ShieldCheck className="h-6 w-6 text-(--db-primary)"/>
            </div>
            <div>
                <h2 className="text-xl nothing-title text-(--db-text)">VERIFY</h2>
                <p className="nothing-label text-[9px]">Identity_Validation_Node</p>
            </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) setEmailConfirmed(true);
          }}
          className="space-y-5"
        >
          <div className="space-y-1.5">
            <label className="nothing-label block ml-1 text-[9px]">Target_Email</label>
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) group-focus-within:text-(--db-primary) transition-colors pointer-events-none">
                    <Mail className="h-4.5 w-4.5" />
                </div>
                <input
                    type="email"
                    required
                    className="pl-11 bg-(--db-surface-hover) border-(--db-border) focus:border-(--db-text) text-sm font-bold w-full"
                    placeholder="USER@DOMAIN.COM"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                />
            </div>
          </div>
          <button
            type="submit"
            disabled={!email}
            className="btn-primary w-full py-3.5 text-xs tracking-widest"
          >
            REQUEST_ACCESS_CODE
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-4 mb-8 border-b border-(--db-border)/30 pb-6">
          <div className="bg-(--db-primary)/10 p-3 rounded-2xl shrink-0">
              <KeyRound className="h-6 w-6 text-(--db-primary)"/>
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
                className="w-full text-center text-3xl font-dot tracking-[0.4em] py-5 bg-(--db-surface-hover) border border-(--db-border) rounded-2xl focus:outline-none focus:border-(--db-text) transition-all" 
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
                   <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </div>
            ) : resendMessage ? (
                <div className="text-green-500 font-bold text-[9px] uppercase tracking-widest flex items-center gap-2">
                   <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> {resendMessage}
                </div>
            ) : null}
        </div>
        
        <button 
            type="submit" 
            disabled={loading || otp.length < 6} 
            className="btn-primary w-full py-3.5 text-xs tracking-widest shadow-lg shadow-(--db-primary)/20"
        >
            {loading ? <Loader2 className="animate-spin h-5 w-5 mx-auto"/> : "CONFIRM_PAYLOAD"}
        </button>

        <div className="text-center pt-2">
            <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resendLoading}
                className="nothing-label text-[9px] hover:text-(--db-text) flex items-center justify-center gap-2 mx-auto transition-colors disabled:opacity-50"
            >
                {resendLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <RefreshCw className={`h-3 w-3 ${cooldown > 0 ? "" : "hover:rotate-180 transition-transform duration-700"}`} />
                )}
                {cooldown > 0 
                    ? `RESEND_AVAILABLE_IN_${cooldown}S` 
                    : "RESEND_DISPATCH_CODE"}
            </button>
        </div>

      </form>
    </div>
  );
}

export default function VerifyForm() { 
  return (
    <Suspense fallback={<div className="text-center p-10 nothing-label animate-pulse text-[9px]">BOOTING_VALIDATOR_NODE...</div>}>
        <VerifyContent/>
    </Suspense>
  ); 
}
