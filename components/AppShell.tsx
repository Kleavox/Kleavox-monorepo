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
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-110 animate-reveal">
          <div className="flex justify-center mb-10">
             <DeauBitLogo size={64} />
          </div>
          <div className="db-card p-6 sm:p-10 shadow-2xl bg-(--db-surface)">
            {children}
          </div>
          <footer className="mt-12 text-center">
            <p className="nothing-label opacity-40">
              Powered by VorDeau &copy; {new Date().getFullYear()}
            </p>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-50 px-4 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between glass-panel rounded-full px-6 py-3 shadow-xl">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/" className="hover:scale-110 transition-transform active:scale-95 shrink-0">
              <DeauBitLogo size={32} />
            </Link>
            
            {!isLandingPage && (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link href="/dash" className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-dot tracking-widest transition-all ${pathname === "/dash" ? "bg-(--db-text) text-(--db-bg)" : "hover:bg-(--db-surface-hover) text-(--db-text-muted)"}`}>
                  <LayoutDashboard className="h-3.5 w-3.5" /> <span className="hidden md:inline">DASH</span>
                </Link>
                <Link href="/dash/settings" className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-dot tracking-widest transition-all ${pathname === "/dash/settings" ? "bg-(--db-text) text-(--db-bg)" : "hover:bg-(--db-surface-hover) text-(--db-text-muted)"}`}>
                  <Settings className="h-3.5 w-3.5" /> <span className="hidden md:inline">SETTINGS</span>
                </Link>
                {user?.role === "ADMIN" && (
                  <Link href="/admin" className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[10px] font-dot tracking-widest transition-all ${isAdminPage ? "bg-(--db-primary) text-white" : "text-(--db-primary) hover:bg-(--db-primary)/10"}`}>
                    <ShieldAlert className="h-3.5 w-3.5" /> <span className="hidden md:inline">ADMIN</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                {!isLandingPage && (
                  <div className="hidden md:flex flex-col items-end leading-none">
                    <span className="nothing-label opacity-40 scale-75 origin-right mb-0.5">Authenticated</span>
                    <span className="text-xs font-black tracking-tight uppercase">{user.email.split('@')[0]}</span>
                  </div>
                )}
                <button 
                  onClick={handleLogout}
                  className="p-3 rounded-full bg-(--db-surface) border border-(--db-border) hover:bg-(--db-primary) hover:text-white hover:border-(--db-primary) transition-all active:scale-90 shadow-sm"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              isLandingPage && (
                <Link href="/login" className="btn-primary px-6 py-2 text-[10px] tracking-widest">
                  AUTHORIZE_
                </Link>
              )
            )}
          </div>
        </div>
      </nav>

      <main className={`flex-1 ${isLandingPage ? "w-full" : "container-nothing"} py-6 md:py-12 animate-reveal`}>
        {children}
      </main>

      <footer className="py-12 border-t border-(--db-border) mt-20 bg-(--db-surface)/30 backdrop-blur-sm">
        <div className="container-nothing flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <DeauBitLogo size={24} />
            <span className="nothing-label">DeauBit Utility v9.2</span>
          </div>
          <div className="nothing-label">
            Powered by VorDeau &copy; {new Date().getFullYear()}
          </div>
        </div>
      </footer>
    </div>
  );
}
