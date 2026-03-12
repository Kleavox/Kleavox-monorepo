//components/VerifyForm.tsx

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck, CheckCircle2, RefreshCw, AlertCircle } from "lucide-react";

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

      setResendMessage("New code sent! Check inbox/spam.");
      setCooldown(60); 
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setResendLoading(false);
    }
  }

  if (success) {
    return (
      <div className="bg-(--db-surface) border-4 border-(--db-border) p-8 shadow-[8px_8px_0px_0px_var(--db-border)] text-center animate-in zoom-in-95 duration-300 w-full max-w-md">
         <div className="inline-flex p-4 bg-(--db-success) border-4 border-(--db-border) rounded-full mb-6 shadow-[4px_4px_0px_0px_var(--db-border)] animate-in zoom-in-50 duration-300">
             <CheckCircle2 className="h-12 w-12 text-white" />
         </div>
         <h2 className="text-3xl font-black uppercase text-(--db-text) mb-2">ACCOUNT VERIFIED!</h2>
         <p className="text-sm font-bold text-(--db-text-muted) mb-8">
            Your account has been successfully created. You can now login to your dashboard.
         </p>
         
         <button 
            onClick={() => router.push("/")}
            className="w-full bg-(--db-text) text-(--db-bg) py-4 font-black uppercase border-2 border-(--db-border) hover:shadow-[6px_6px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all"
         >
            GO TO LOGIN
         </button>
      </div>
    );
  }

  if (!emailConfirmed) {
    return (
      <div className="bg-(--db-surface) border-4 border-(--db-border) p-8 shadow-[8px_8px_0px_0px_var(--db-border)] text-center w-full max-w-md">
        <div className="inline-block p-3 bg-(--db-accent) border-2 border-(--db-border) rounded-full mb-4">
          <ShieldCheck className="h-8 w-8 text-(--db-accent-fg)" />
        </div>
        <h2 className="text-2xl font-black uppercase text-(--db-text) mb-1">VERIFY EMAIL</h2>
        <p className="text-xs font-bold text-(--db-text-muted) mb-6">Enter your email address to receive a verification code.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) setEmailConfirmed(true);
          }}
          className="space-y-4"
        >
          <input
            type="email"
            required
            className="w-full bg-(--db-bg) border-4 border-(--db-border) px-4 py-3 text-base font-bold text-(--db-text) placeholder:font-normal placeholder:text-(--db-text-muted) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <button
            type="submit"
            disabled={!email}
            className="w-full bg-(--db-primary) text-(--db-primary-fg) py-3 font-black uppercase border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            CONTINUE
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-(--db-surface) border-4 border-(--db-border) p-8 shadow-[8px_8px_0px_0px_var(--db-border)] text-center w-full max-w-md">
      <div className="inline-block p-3 bg-(--db-accent) border-2 border-(--db-border) rounded-full mb-4">
          <ShieldCheck className="h-8 w-8 text-(--db-accent-fg)"/>
      </div>
      <h2 className="text-2xl font-black uppercase text-(--db-text) mb-1">VERIFY EMAIL</h2>
      <p className="text-xs font-bold text-(--db-text-muted) mb-6">Code sent to {email}</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <input 
            className="w-full text-center text-3xl font-mono font-bold tracking-[0.5em] py-4 bg-(--db-bg) border-4 border-(--db-border) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] text-(--db-text) placeholder:text-(--db-text-muted) transition-all" 
            placeholder="000000" 
            maxLength={6} 
            value={otp} 
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} 
            autoFocus 
        />
        
        <div className="min-h-[3.5rem] flex items-center justify-center px-1">
            {error ? (
                <div className="bg-(--db-danger) text-white font-bold text-xs p-2 border-2 border-(--db-border) shadow-[2px_2px_0px_0px_var(--db-border)] w-full animate-in fade-in slide-in-from-top-1 duration-200 flex items-center justify-center gap-2">
                   <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
            ) : resendMessage ? (
                <div className="bg-(--db-success) text-white font-bold text-xs p-2 border-2 border-(--db-border) shadow-[2px_2px_0px_0px_var(--db-border)] w-full animate-in fade-in slide-in-from-top-1 duration-200 flex items-center justify-center gap-2">
                   <CheckCircle2 className="h-4 w-4 shrink-0" /> {resendMessage}
                </div>
            ) : (
                <div className="w-full h-full flex items-center justify-center opacity-0 pointer-events-none text-xs font-bold text-(--db-text-muted)">
                    Waiting for input...
                </div>
            )}
        </div>
        
        <button 
            type="submit" 
            disabled={loading || otp.length < 6} 
            className="w-full bg-(--db-primary) text-(--db-primary-fg) py-3 font-black uppercase border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {loading ? <Loader2 className="animate-spin mx-auto"/> : "CONFIRM CODE"}
        </button>

        <div className="text-center pt-2">
            <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || resendLoading}
                className="text-xs font-bold text-(--db-text-muted) hover:text-(--db-primary) disabled:opacity-50 disabled:hover:text-(--db-text-muted) flex items-center justify-center gap-2 mx-auto transition-colors h-8"
            >
                {resendLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                    <RefreshCw className={`h-3 w-3 ${cooldown > 0 ? "" : "hover:rotate-180 transition-transform"}`} />
                )}
                {cooldown > 0 
                    ? `Resend available in ${cooldown}s` 
                    : "Didn't receive code? Resend"}
            </button>
        </div>

      </form>
    </div>
  );
}

export default function VerifyForm() { 
  return (
    <Suspense fallback={<div className="text-center p-10 font-bold">Loading...</div>}>
        <VerifyContent/>
    </Suspense>
  ); 
}
