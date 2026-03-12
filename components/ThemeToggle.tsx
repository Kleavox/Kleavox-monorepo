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
    const isDark = document.documentElement.classList.contains("dark");
    const currentTheme = isDark ? "dark" : "light";
    
    