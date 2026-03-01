//components/ThemeToggle.tsx

"use client";

import { useState, useEffect } from "react";
import { Moon, SunMedium, Loader2 } from "lucide-react";

type Theme = "light" | "dark";

const THEME_COOKIE_NAME = "deaubit_theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

function getRootDomainFromEnv(): string | null {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) return null;

  try {
    const host = new URL(base).hostname;
    const parts = host.split(".");
    if (parts.length < 2) return host;
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

const ROOT_DOMAIN = getRootDomainFromEnv();

function writeThemeCookie(theme: Theme) {
  if (typeof document === "undefined") return;

  document.cookie = `${THEME_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;

  let cookie =
    `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}` +
    `; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;

  if (ROOT_DOMAIN) {
    cookie += `; domain=.${ROOT_DOMAIN}`;
  }

  document.cookie = cookie;
}

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  function setThemeEverywhere(newTheme: Theme) {
    const html = document.documentElement;

    if (newTheme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }

    try {
      window.localStorage.setItem("theme", newTheme);
    } catch {}

    writeThemeCookie(newTheme);
    setTheme(newTheme);
  }

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setThemeEverywhere(next);
  }

  if (!mounted) {
    return (
      <div className="fixed right-4 bottom-4 z-50 p-3 bg-[var(--db-surface)] border-2 border-[var(--db-border)] shadow-[4px_4px_0px_0px_var(--db-border)]">
         <Loader2 className="h-6 w-6 animate-spin text-[var(--db-text)]" />
      </div>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={`
        fixed right-4 bottom-4 z-50 
        flex items-center justify-center
        p-3
        bg-[var(--db-surface)] border-2 border-[var(--db-border)]
        shadow-[4px_4px_0px_0px_var(--db-border)] 
        hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--db-border)] 
        active:translate-y-0 active:shadow-[2px_2px_0px_0px_var(--db-border)]
        transition-all 
        cursor-pointer
      `}
    >
      <div className="text-[var(--db-text)]">
        {isDark ? (
            <Moon className="h-6 w-6 fill-current" />
        ) : (
            <SunMedium className="h-6 w-6 fill-yellow-400" />
        )}
      </div>
    </button>
  );
}
