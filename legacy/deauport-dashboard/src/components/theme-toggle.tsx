"use client";
import { useEffect, useState } from "react";

const KEY = "deauport_theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as "dark" | "light" | null) ?? "dark";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(KEY, next);
    document.documentElement.setAttribute("data-theme", next === "light" ? "light" : "dark");
  }

  return (
    <button onClick={toggle} className="btn btn-ghost" title="Toggle theme">
      {theme === "dark" ? "🌙" : "☀️"}
      <span className="hidden sm:inline">{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}