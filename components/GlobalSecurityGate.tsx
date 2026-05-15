// components/GlobalSecurityGate.tsx

"use client";

import { useState, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { CircleNotch, Warning, ArrowClockwise } from "@phosphor-icons/react";

export default function GlobalSecurityGate({ children }: { children: React.ReactNode }) {
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    const init = async () => {
      setMounted(true);

      const savedTheme = localStorage.getItem("db-theme") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }

      const lastVerified = localStorage.getItem("db_human_verified");
      if (lastVerified) {
        const age = Date.now() - parseInt(lastVerified);
        if (age < 1800000) {
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
        setTimeout(() => setIsVerified(true), 500);
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
    <div className={`fixed inset-0 z-9999 flex flex-col items-center justify-center bg-(--db-bg) text-(--db-text) animate-reveal ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="w-full max-w-md p-8 flex flex-col items-center justify-center space-y-10 text-center">

        <div className="space-y-3">
          <div className="inline-flex p-4 bg-(--db-primary)/10 text-(--db-primary) rounded-3xl mb-2">
            <Warning size={32} weight="fill" />
          </div>
          <h1 className="nothing-title text-4xl text-(--db-text)">SYS.CHECK</h1>
          <p className="nothing-label">Human_Verification_Protocol</p>
        </div>

        <div className="min-h-40 flex flex-col items-center justify-center w-full">
          {verifying ? (
            <div className="flex flex-col items-center gap-6 animate-reveal">
              <CircleNotch size={48} className="animate-spin text-(--db-primary)" />
              <span className="nothing-label animate-pulse">VALIDATING_PAYLOAD...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-6 animate-reveal">
              <div className="bg-red-500/10 p-6 rounded-3xl text-red-500">
                <Warning size={40} weight="fill" />
              </div>
              <p className="nothing-label text-red-500 opacity-100">{error}</p>
              <button
                onClick={() => setError(null)}
                className="btn-primary px-8 py-3 text-[10px] nothing-label opacity-100"
              >
                <ArrowClockwise className="h-3.5 w-3.5" /> RETRY_OPS
              </button>
            </div>
          ) : (
            <div className="db-card p-3 bg-white shadow-2xl overflow-hidden transition-all duration-700 hover:scale-105">
              <Turnstile
                siteKey={siteKey || ""}
                onSuccess={handleSuccess}
                onError={() => setError("Verification failed")}
                options={{ theme: theme, size: 'normal' }}
              />
            </div>
          )}
        </div>

        <div className="pt-10 border-t border-(--db-border)/30 w-full opacity-20">
          <p className="nothing-label text-[8px] normal-case tracking-normal">
            Verifying secure tunnel connection to system endpoint
          </p>
        </div>
      </div>
    </div>
  );
}
