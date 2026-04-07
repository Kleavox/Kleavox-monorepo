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
    <div className="w-full max-w-6xl mx-auto px-6 flex flex-col items-center justify-center animate-reveal">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center w-full">
        
        <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
            <div className="mb-8 lg:mb-12">
                <h1 className="text-5xl sm:text-6xl md:text-8xl nothing-title text-(--db-text) mb-4">DEAUBIT</h1>
                <div className="h-1.5 w-24 bg-(--db-primary) rounded-full mx-auto lg:mx-0"></div>
            </div>
            
            <p className="nothing-label normal-case tracking-normal text-sm mb-10 max-w-md leading-relaxed opacity-70 text-(--db-text)">
                Refined Link Infrastructure. <br className="hidden md:block" />
                Minimalist. Private. Secure. Pure Utility.
            </p>

            <div className="w-full max-w-lg mb-8">
                <PublicShortlinkForm />
            </div>
            
            <div className="flex items-center gap-8 mt-4">
                <Link href="/terms" className="nothing-label text-[10px] text-(--db-text) opacity-50 hover:opacity-100 transition-all font-bold">TERMS_OF_SERVICE</Link>
                <Link href="/privacy" className="nothing-label text-[10px] text-(--db-text) opacity-50 hover:opacity-100 transition-all font-bold">PRIVACY_PROTOCOL</Link>
                <Link href="/report" className="nothing-label text-[10px] text-red-600 hover:text-red-500 transition-all font-bold">REPORT_ABUSE</Link>
            </div>
        </div>

        <div className="lg:col-span-5 w-full flex justify-center">
          <div className="db-card p-8 lg:p-10 shadow-2xl bg-(--db-surface) w-full max-w-md border-(--db-border)">
             <LoginForm nextPath={nextPath} />
          </div>
        </div>

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
