// components/GlobalSecurityGate.tsx

"use client";

import { useState, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export default function GlobalSecurityGate({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    const init = async () => {
        setMounted(true);
        const lastVerified = localStorage.getItem("db_human_verified");
        if (lastVerified) {
            const age = Date.now() - parseInt(lastVerified);
            if (age < 1800000) { // 30 minutes
                setIsVerified(true);
                return;
            }
        }
        setIsVerified(false);
    };

    const timer = setTimeout(init, 0);
    return () => clearTimeout(timer);
  }, []);

  const handleSuccess = async (token: string) => {
    setVerifying(true);
    setError(null);
    
    try {
      const res = await fetch("/api/auth/verify-turnstile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      
      if (res.ok) {
        localStorage.setItem("db_human_verified", Date.now().toString());
        setTimeout(() => {
          setIsVerified(true);
        }, 500);
      } else {
        setError("Verification failed");
        setVerifying(false);
      }
    } catch {
      setError("Verification failed");
      setVerifying(false);
    }
  };

  if (!mounted || isVerified === null) return null;
  if (isVerified) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-9999 flex flex-col items-center justify-center bg-(--db-bg) text-(--db-text) animate-reveal">
      <div className="w-full max-w-md p-8 flex flex-col items-center justify-center space-y-10 text-center">
        
        <div className="space-y-3">
          <h1 className="nothing-title text-4xl text-(--db-primary)">SYS.CHECK</h1>
          <p className="nothing-label">Human_Verification_Protocol</p>
        </div>

        <div className="min-h-40 flex flex-col items-center justify-center w-full">
          {verifying ? (
            <div className="flex flex-col items-center gap-6 animate-reveal">
              <Loader2 className="h-12 w-12 animate-spin text-(--db-primary)" />
              <span className="nothing-label animate-pulse">VALIDATING_PAYLOAD...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-6 animate-reveal">
              <div className="bg-red-500/10 p-6 rounded-3xl text-red-500">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <p className="nothing-label text-red-500 opacity-100">{error}</p>
              <button 
                onClick={() => { setError(null); }}
                className="btn-primary px-8 py-3 text-[10px] nothing-label text-white opacity-100"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" /> RETRY_OPS
              </button>
            </div>
          ) : (
            <div className="db-card p-3 bg-white shadow-2xl overflow-hidden transition-all duration-700 hover:scale-105 border-white/5">
              <Turnstile 
                siteKey={siteKey || ""} 
                onSuccess={handleSuccess}
                onError={() => { 
                    setError("Verification failed"); 
                }}
                options={{ theme: 'light', size: 'normal' }}
              />
            </div>
          )}
        </div>

        <div className="pt-10 border-t border-(--db-border)/30 w-full opacity-30">
          <p className="nothing-label text-[8px] normal-case tracking-normal">
            Verifying secure tunnel connection to system endpoint
          </p>
        </div>

      </div>
    </div>
  );
}
