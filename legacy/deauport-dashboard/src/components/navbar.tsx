"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}
function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const saved = (localStorage.getItem("theme") as Theme | null) ?? null;
  return saved ?? getSystemTheme();
}
function applyTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem("theme", t);
}

export default function Navbar({ authed }: { authed?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = readTheme();
    setTheme(t);
    applyTheme(t);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const tab = (href: string, label: string) => {
    const active = pathname === href || pathname?.startsWith(href + "/");
    const base =
      "inline-flex items-center rounded-md border border-[var(--border)] px-3 py-1.5 text-sm";
    const on = "bg-[var(--surface-2)] text-[var(--text)]";
    const off = "text-subtle hover:bg-[color-mix(in_srgb,var(--surface-2)_80%,white_10%)]";
    return (
      <Link href={href} className={`${base} ${active ? on : off}`} prefetch={false}>
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur supports-[backdrop-filter]:bg-[var(--bg)]/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="text-sm font-semibold tracking-wide" prefetch={false}>
          Deauport
        </Link>

        <nav className="ml-2 hidden items-center gap-2 sm:flex">
          {tab("/", "Dashboard")}
          {authed && tab("/manage", "Manage")}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn btn-ghost"
            aria-label="Toggle theme"
            title="Toggle theme"
            onClick={toggleTheme}
          >
            {theme === "dark" ? "☾" : "☀︎"}
          </button>

          <div className="relative" ref={menuRef}>
            <button
              className="btn btn-ghost"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
              title="Menu"
            >
              ⋯
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)] shadow-lg"
              >
                <Link
                  href="/about"
                  prefetch={false}
                  className="block px-3 py-2 text-sm hover:bg-[var(--surface-3)]"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  About
                </Link>

                <div className="border-t border-[var(--border)]" />

                {authed ? (
                  <form action="/api/auth/logout" method="post">
                    <button
                      type="submit"
                      className="block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-[var(--surface-3)]"
                      role="menuitem"
                      title="Logout"
                    >
                      Logout
                    </button>
                  </form>
                ) : (
                  <Link
                    href="/login"
                    prefetch={false}
                    className="block px-3 py-2 text-sm hover:bg-[var(--surface-3)]"
                    role="menuitem"
                    title="Login"
                    onClick={() => setOpen(false)}
                  >
                    Login
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}