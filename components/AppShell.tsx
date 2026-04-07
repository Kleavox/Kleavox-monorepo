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

  const isAuthPage = [
    "/login", "/register", "/verify", "/forgot-password", "/reset-password", "/account-deleted", "/setup"
  ].includes(pathname);

  const isHomePage = pathname === "/";

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

  if (isAuthPage || isHomePage) {
    return (
      <div className="min-h-dvh flex flex-col bg-(--db-bg)">
        <main className="flex-1 flex flex-col items-center justify-center p-4">
           {children}
        </main>
        <footer className="py-6 text-center">
            <p className="nothing-label text-[10px] text-(--db-text) opacity-40 font-bold">
              VORDEAU_SYSTEM_CORE &copy; {new Date().getFullYear()}
            </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-(--db-bg)">
      <nav className="sticky top-0 z-50 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between glass-panel rounded-full px-5 py-2 shadow-xl border-white/5">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/" className="hover:scale-110 transition-transform active:scale-95 shrink-0">
              <DeauBitLogo size={28} />
            </Link>
            
            <div className="flex items-center gap-1">
              <Link href="/dash" className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-dot tracking-widest transition-all ${pathname === "/dash" ? "bg-(--db-text) text-(--db-bg)" : "hover:bg-(--db-surface-hover) text-(--db-text-muted)"}`}>
                <LayoutDashboard className="h-3 w-3" /> <span className="hidden sm:inline">DASH</span>
              </Link>
              <Link href="/dash/settings" className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-dot tracking-widest transition-all ${pathname === "/dash/settings" ? "bg-(--db-text) text-(--db-bg)" : "hover:bg-(--db-surface-hover) text-(--db-text-muted)"}`}>
                <Settings className="h-3 w-3" /> <span className="hidden sm:inline">SETTINGS</span>
              </Link>
              {user?.role === "ADMIN" && (
                <Link href="/admin" className={`flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-dot tracking-widest transition-all ${pathname.startsWith("/admin") ? "bg-(--db-primary) text-white" : "text-(--db-primary) hover:bg-(--db-primary)/10"}`}>
                  <ShieldAlert className="h-3 w-3" /> <span className="hidden sm:inline">ADMIN</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <>
                <div className="hidden md:flex flex-col items-end leading-none">
                  <span className="nothing-label scale-75 origin-right opacity-40">Auth_OK</span>
                  <span className="text-[10px] font-black uppercase">{user.email.split('@')[0]}</span>
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 rounded-full bg-(--db-surface) border border-(--db-border) hover:bg-(--db-primary) hover:text-white hover:border-(--db-primary) transition-all active:scale-90 shadow-sm"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 container-nothing py-4 md:py-6 animate-reveal">
        {children}
      </main>

      <footer className="py-6 border-t border-(--db-border) mt-auto bg-(--db-surface)/30 backdrop-blur-sm">
        <div className="container-nothing flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <DeauBitLogo size={20} />
            <span className="nothing-label text-[8px]">Utility_v9.2</span>
          </div>
          <div className="nothing-label text-[8px] opacity-20">
            Powered by VorDeau &copy; {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
