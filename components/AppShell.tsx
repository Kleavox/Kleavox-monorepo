//components/AppShell.tsx

"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Settings, LogOut, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import DeauBitLogo from "./DeauBitLogo";

interface UserInfo {
  email: string;
  role: string;
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);

  const isAdminPage = pathname.startsWith("/admin");

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch("/api/session");
        const data = await res.json();
        if (data.authenticated) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Session fetch error", err);
      }
    }
    fetchSession();
  }, []);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const isAuthPage = [
    "/login", "/register", "/verify", "/forgot-password", "/reset-password", "/account-deleted", "/setup"
  ].includes(pathname);

  const isLandingPage = ["/", "/terms", "/privacy", "/report"].includes(pathname);

  if (isAuthPage) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-8 bg-(--db-bg)">
        <div className="w-full max-w-100 animate-reveal">
          <div className="flex justify-center mb-8">
             <DeauBitLogo size={56} />
          </div>
          <div className="db-card p-6 sm:p-8 shadow-2xl bg-(--db-surface)">
            {children}
          </div>
          <footer className="mt-8 text-center opacity-30">
            <p className="nothing-label text-[8px]">
              VORDEAU SYSTEM &copy; {new Date().getFullYear()}
            </p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-(--db-bg)">
      <nav className="sticky top-0 z-50 px-4 py-3 md:py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between glass-panel rounded-full px-5 py-2 md:py-2.5 shadow-xl border-white/5">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" className="hover:scale-110 transition-transform active:scale-95 shrink-0">
              <DeauBitLogo size={28} />
            </Link>
            
            {!isLandingPage && (
              <div className="flex items-center gap-1">
                <Link href="/dash" className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-dot tracking-widest transition-all ${pathname === "/dash" ? "bg-(--db-text) text-(--db-bg)" : "hover:bg-(--db-surface-hover) text-(--db-text-muted)"}`}>
                  <LayoutDashboard className="h-3 w-3" /> <span className="hidden sm:inline">DASH</span>
                </Link>
                <Link href="/dash/settings" className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-dot tracking-widest transition-all ${pathname === "/dash/settings" ? "bg-(--db-text) text-(--db-bg)" : "hover:bg-(--db-surface-hover) text-(--db-text-muted)"}`}>
                  <Settings className="h-3 w-3" /> <span className="hidden sm:inline">SETTINGS</span>
                </Link>
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-dot tracking-widest transition-all ${isAdminPage ? "bg-(--db-primary) text-white" : "text-(--db-primary) hover:bg-(--db-primary)/10"}`}>
                    <ShieldAlert className="h-3 w-3" /> <span className="hidden sm:inline">ADMIN</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                {!isLandingPage && (
                  <div className="hidden md:flex flex-col items-end leading-none">
                    <span className="nothing-label scale-75 origin-right opacity-40">Auth_OK</span>
                    <span className="text-[10px] font-black uppercase">{user.email.split('@')[0]}</span>
                  </div>
                )}
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-full bg-(--db-surface) border border-(--db-border) hover:bg-(--db-primary) hover:text-white hover:border-(--db-primary) transition-all active:scale-90 shadow-sm"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              isLandingPage && (
                <Link href="/login" className="btn-primary px-5 py-1.5 text-[9px] tracking-widest">
                  AUTHORIZE_
                </Link>
              )
            )}
          </div>
        </div>
      </nav>

      <main className={`flex-1 ${isLandingPage ? "w-full" : "container-nothing"} py-4 md:py-8 animate-reveal`}>
        {children}
      </main>

      <footer className="py-8 border-t border-(--db-border) mt-auto bg-(--db-surface)/30 backdrop-blur-sm">
        <div className="container-nothing flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DeauBitLogo size={20} />
            <span className="nothing-label text-[8px]">Utility_v9.2</span>
          </div>
          <div className="nothing-label text-[8px] opacity-30">
            Powered by VorDeau &copy; {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
