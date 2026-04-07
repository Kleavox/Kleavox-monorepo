//app/page.tsx

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DeauBitLogo from "@/components/DeauBitLogo";
import LoginForm from "@/components/LoginForm";
import PublicShortlinkForm from "@/components/PublicShortlinkForm";
import Link from "next/link";

function HomeContent() {
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dash";

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const setupReq = fetch("/api/setup/status");
        const sessionReq = fetch("/api/session", { method: "GET", credentials: "include" });

        const setupRes = await setupReq;
        const setupData = await setupRes.json();
        
        if (!cancelled && !setupData.initialized) {
            router.replace("/setup");
            return;
        }

        const res = await sessionReq;
        const data = await res.json();
        
        if (!cancelled && data.authenticated) {
          router.replace(nextPath);
          return;
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [router, nextPath]);

  if (checkingSession) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-(--db-bg) z-60">
        <div className="flex flex-col items-center gap-8">
          <DeauBitLogo size={64} className="animate-pulse" />
          <div className="nothing-label tracking-[0.5em] animate-pulse">
            INITIALIZING_CORE_SYSTEM
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-4 md:py-12 min-h-[calc(100vh-180px)] flex flex-col justify-center">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center">
        
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1">
            <div className="mb-12 lg:mb-20">
                <h1 className="text-6xl sm:text-7xl md:text-9xl nothing-title text-(--db-text) mb-6">DEAUBIT</h1>
                <div className="h-1.5 w-32 bg-(--db-primary) rounded-full mx-auto lg:mx-0"></div>
            </div>
            
            <p className="nothing-label normal-case tracking-normal text-sm md:text-base mb-12 max-w-lg leading-relaxed opacity-60">
                Refined Link Infrastructure for the modern web. <br className="hidden md:block" />
                Minimalist. Private. Secure. Pure Utility.
            </p>

            <div className="w-full max-w-xl mb-12">
                <PublicShortlinkForm />
            </div>
            
            <div className="items-center gap-10 opacity-20 hidden lg:flex mt-6">
                <div className="flex flex-col">
                    <span className="nothing-label text-[8px]">Secure_Protocol</span>
                    <div className="h-px w-full bg-(--db-text) mt-1"></div>
                </div>
                <div className="flex flex-col">
                    <span className="nothing-label text-[8px]">Zero_Logs</span>
                    <div className="h-px w-full bg-(--db-text) mt-1"></div>
                </div>
                <div className="flex flex-col">
                    <span className="nothing-label text-[8px]">Encrypted_Mesh</span>
                    <div className="h-px w-full bg-(--db-text) mt-1"></div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-5 w-full order-1 lg:order-2 flex justify-center">
          <div className="db-card p-10 lg:p-12 shadow-2xl bg-(--db-surface) w-full max-w-md border-white/5">
             <LoginForm nextPath={nextPath} />
          </div>
        </div>

      </div>

      <div className="mt-20 pt-10 border-t border-(--db-border)/30 flex flex-wrap justify-center lg:justify-start gap-10">
          <Link href="/terms" className="nothing-label text-[9px] hover:text-(--db-primary) transition-colors">TERMS_OF_SERVICE</Link>
          <Link href="/privacy" className="nothing-label text-[9px] hover:text-(--db-primary) transition-colors">PRIVACY_PROTOCOL</Link>
          <Link href="/report" className="nothing-label text-[9px] text-red-500 hover:text-red-400 transition-colors">REPORT_ABUSE</Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense 
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-(--db-bg) z-50">
          <DeauBitLogo size={48} className="animate-pulse" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
