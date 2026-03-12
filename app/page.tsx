//app/page.tsx

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Zap } from "lucide-react";
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
      <div className="fixed inset-0 flex items-center justify-center bg-(--db-bg) z-50">
        <div className="border-4 border-(--db-border) bg-(--db-surface) p-8 shadow-[8px_8px_0px_0px_var(--db-border)] flex flex-col items-center gap-4">
          <DeauBitLogo size={48} />
          <div className="flex items-center gap-2 font-bold text-xl uppercase tracking-widest text-(--db-text)">
            <Loader2 className="h-6 w-6 animate-spin" /> Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-16 min-h-[calc(100vh-80px)] flex flex-col justify-center">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        
        <div className="lg:col-span-7 order-1 h-full flex flex-col">
          <div className="db-card animate-float flex flex-col h-full">
            
            <div className="bg-(--db-accent) p-6 md:p-8 border-b-4 border-(--db-border)">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="bg-(--db-surface) p-3 border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)]">
                        <DeauBitLogo size={40} />
                    </div>
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-(--db-accent-fg) leading-none">DeauBit</h1>
                        <p className="text-sm font-bold text-(--db-accent-fg) opacity-90 mt-1">Elegant & Brutal URL Shortener.</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3 p-3 bg-(--db-bg) border-2 border-(--db-border)">
                        <Zap className="h-5 w-5 text-(--db-primary) shrink-0" />
                        <p className="text-xs font-bold text-(--db-text) leading-tight">No Tracking. Privacy First. Self-hosted.</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-(--db-text-muted) p-2">
                         <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> 
                         Operational & Ready
                    </div>
                </div>

                <div className="h-1 bg-(--db-bg) border-t-2 border-(--db-border) border-dashed my-2" />
                
                <div>
                     <PublicShortlinkForm />
                </div>
            </div>

            <div className="hidden lg:block bg-(--db-text) p-4 text-center border-t-4 border-(--db-border) mt-auto">
                <span className="text-[10px] font-bold text-(--db-bg) uppercase tracking-widest block mb-2">POWERED BY DEAUPORT</span>
                <div className="flex justify-center gap-4 text-[10px] font-bold text-(--db-bg)/80">
                    <Link href="/terms" className="hover:text-white hover:underline transition-colors">Terms</Link>
                    <span>•</span>
                    <Link href="/privacy" className="hover:text-white hover:underline transition-colors">Privacy</Link>
                    <span>•</span>
                    <Link href="/report" className="text-red-300 hover:text-red-100 hover:underline transition-colors">Report Abuse</Link>
                </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 order-2 h-full flex flex-col">
          <LoginForm nextPath={nextPath} />

          <div className="block lg:hidden bg-(--db-text) p-4 text-center border-4 border-(--db-border) mt-6 shadow-[4px_4px_0px_0px_var(--db-border)]">
              <span className="text-[10px] font-bold text-(--db-bg) uppercase tracking-widest block mb-2">POWERED BY DEAUPORT</span>
              <div className="flex justify-center gap-4 text-[10px] font-bold text-(--db-bg)/80">
                  <Link href="/terms" className="hover:text-white hover:underline transition-colors">Terms</Link>
                  <span>•</span>
                  <Link href="/privacy" className="hover:text-white hover:underline transition-colors">Privacy</Link>
                  <span>•</span>
                  <Link href="/report" className="text-red-300 hover:text-red-100 hover:underline transition-colors">Report Abuse</Link>
              </div>
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
          <div className="border-4 border-(--db-border) bg-(--db-surface) p-8 shadow-[8px_8px_0px_0px_var(--db-border)] flex flex-col items-center gap-4">
            <DeauBitLogo size={48} />
            <div className="flex items-center gap-2 font-bold text-xl uppercase tracking-widest text-(--db-text)">
              <Loader2 className="h-6 w-6 animate-spin" /> Loading...
            </div>
          </div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
