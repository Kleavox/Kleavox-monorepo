//app/setup/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Server, KeyRound, RefreshCw, Terminal, ChevronRight } from "lucide-react";
import DeauBitLogo from "@/components/DeauBitLogo";

export default function SetupPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"form" | "otp">("form");
  const router = useRouter();

  const [formData, setFormData] = useState({ name: "Administrator", email: "", password: "" });
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.initialized) router.replace("/");
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (resendCooldown > 0) {
        const timer = setInterval(() => setResendCooldown(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStep("otp");
      setResendCooldown(60); 
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
      if (resendCooldown > 0) return;
      setResendLoading(true); setError("");
      try {
          const res = await fetch("/api/auth/resend-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: formData.email })
          });
          if(!res.ok) throw new Error("Failed");
          setResendCooldown(60);
      } catch {
          setError("Failed to resend.");
      } finally {
          setResendLoading(false);
      }
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-(--db-bg) gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-(--db-text)" />
        <p className="font-mono text-sm font-bold uppercase tracking-widest animate-pulse">Booting System...</p>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--db-bg) px-4 py-12 font-mono">
      <div className="w-full max-w-lg bg-(--db-surface) border-4 border-(--db-border) shadow-[16px_16px_0px_0px_var(--db-text)] p-0 overflow-hidden">
        
        <div className="bg-(--db-text) p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Terminal className="h-5 w-5 text-white" />
                <span className="text-white font-bold text-sm uppercase tracking-wider">DeauBit Install Wizard</span>
            </div>
            <div className="flex gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full border border-black"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full border border-black"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full border border-black"></div>
            </div>
        </div>

        <div className="p-8">
            <div className="flex items-center gap-4 mb-8 border-b-4 border-(--db-border) pb-6 border-dashed">
                <div className="bg-(--db-bg) border-2 border-(--db-border) p-2">
                    <DeauBitLogo size={40} />
                </div>
                <div>
                    <h1 className="text-2xl font-black uppercase text-(--db-text) leading-none mb-1">System Init</h1>
                    <p className="text-xs font-bold text-(--db-text-muted) uppercase">v1.0.0 &bull; Build 2025</p>
                </div>
            </div>

            {step === "form" ? (
                <form onSubmit={handleSetup} className="space-y-5">
                    <div className="bg-yellow-100 p-4 border-2 border-(--db-border) flex items-start gap-3">
                        <div className="bg-yellow-400 border border-(--db-border) p-1">
                            <Server className="h-4 w-4 text-black" />
                        </div>
                        <div>
                            <p className="text-xs font-bold text-black uppercase mb-1">Status: No Admin Found</p>
                            <p className="text-[10px] font-medium text-(--db-text-muted) leading-tight">
                                Create the root administrator account to unlock the system database.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="group">
                            <label className="font-black text-[10px] uppercase mb-1 block group-focus-within:text-(--db-primary)">Root Name</label>
                            <input className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Administrator" required />
                        </div>
                        <div className="group">
                            <label className="font-black text-[10px] uppercase mb-1 block group-focus-within:text-(--db-primary)">Root Email</label>
                            <input type="email" className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="admin@system.local" required />
                        </div>
                        <div className="group">
                            <label className="font-black text-[10px] uppercase mb-1 block group-focus-within:text-(--db-primary)">Root Password</label>
                            <input type="password" className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder="••••••••" required minLength={8} />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500 text-white font-bold p-3 border-2 border-(--db-border) text-xs flex items-center gap-2">
                            <span className="text-lg">!</span> {error}
                        </div>
                    )}

                    <button type="submit" disabled={submitting} className="w-full bg-(--db-text) text-(--db-bg) py-4 font-black uppercase border-2 border-(--db-border) hover:shadow-[6px_6px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2 mt-2">
                        {submitting ? <Loader2 className="animate-spin h-4 w-4"/> : <>INITIALIZE <ChevronRight className="h-4 w-4"/></>}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerify} className="space-y-6 text-center">
                    <div className="inline-block p-4 bg-(--db-bg) border-4 border-(--db-border) rounded-full mb-2 shadow-[4px_4px_0px_0px_var(--db-border)]">
                        <KeyRound className="h-8 w-8 text-(--db-text)" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight">2FA Verification</h2>
                        <p className="text-xs font-bold text-(--db-text-muted) mt-1">Enter the access code sent to {formData.email}</p>
                    </div>
                    
                    <input 
                        className="w-full text-center text-3xl font-mono font-bold tracking-[0.5em] py-4 bg-(--db-bg) border-4 border-(--db-border) focus:outline-none focus:shadow-[6px_6px_0px_0px_var(--db-border)] transition-all text-(--db-text)" 
                        placeholder="000000" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} autoFocus 
                    />
                    
                    {error && <div className="bg-red-500 text-white p-2 font-bold text-xs border-2 border-(--db-border)">{error}</div>}
                    
                    <button type="submit" disabled={submitting || otp.length < 6} className="w-full bg-(--db-primary) text-(--db-primary-fg) py-4 font-black uppercase border-2 border-(--db-border) hover:shadow-[6px_6px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex justify-center items-center gap-2">
                        {submitting ? <Loader2 className="animate-spin h-4 w-4"/> : "AUTHORIZE & LAUNCH"}
                    </button>

                    <button 
                        type="button" 
                        onClick={handleResend} 
                        disabled={resendCooldown > 0 || resendLoading}
                        className="text-[10px] font-bold text-(--db-text-muted) hover:text-(--db-text) uppercase tracking-wide flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
                    >
                        {resendLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : <RefreshCw className={`h-3 w-3 ${resendCooldown === 0 ? "hover:rotate-180 transition-transform" : ""}`}/>}
                        {resendCooldown > 0 ? `Resend Available in ${resendCooldown}s` : "Resend Access Code"}
                    </button>
                </form>
            )}
        </div>
        
        <div className="bg-(--db-border) p-2 text-center">
            <p className="text-[10px] font-bold text-(--db-bg) uppercase">Secure Environment </p>
        </div>
      </div>
    </div>
  );
}
