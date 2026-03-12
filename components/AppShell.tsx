//components/AppShell.tsx

"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Settings } from "lucide-react";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/";
  
  const maxWidth = isLogin 
    ? "max-w-4xl" 
    : "w-full md:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl";

  const isAuthPage = [
    "/", "/login", "/register", "/verify", "/forgot-password", "/reset-password", "/account-deleted", "/setup"
  ].includes(pathname);

  return (
    <div
      className={`
        ${maxWidth} mx-auto
        p-4 sm:p-6 xl:p-8
        bg-(--db-surface) 
        border-2 md:border-4 border-(--db-border) 
        shadow-[6px_6px_0px_0px_var(--db-border)]
        md:shadow-[12px_12px_0px_0px_var(--db-border)]
        transition-all duration-300
        mb-24
      `}
    >
      {!isAuthPage && (
        <nav className="mb-6 flex gap-6 animate-nav-slide-in">
          <Link href="/dash" className={`text-xs font-black uppercase tracking-widest hover:text-(--db-primary) transition-all flex items-center gap-2 ${pathname === "/dash" ? "text-(--db-primary)" : "text-(--db-text-muted)"}`}>
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link href="/dash/settings" className={`text-xs font-black uppercase tracking-widest hover:text-(--db-primary) transition-all flex items-center gap-2 ${pathname === "/dash/settings" ? "text-(--db-primary)" : "text-(--db-text-muted)"}`}>
            <Settings className="h-4 w-4" /> Settings
          </Link>
        </nav>
      )}
      {children}
    </div>
  );
}
