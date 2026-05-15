//components/ThemeToggle.tsx

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const initTheme = () => {
      const savedTheme = localStorage.getItem("db-theme") as "light" | "dark" | null;
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle("dark", savedTheme === "dark");
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setTheme("dark");
        document.documentElement.classList.add("dark");
      }
    };
    const timer = setTimeout(initTheme, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
    localStorage.setItem("db-theme", newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-6 right-6 z-100 p-3 rounded-full glass-panel shadow-2xl hover:scale-110 active:scale-95 transition-all duration-500 group"
      title={theme === "light" ? "Activate Dark Protocol" : "Activate Light Protocol"}
    >
      <div className="relative w-5 h-5">
        <Sun
          weight="fill"
          className={`absolute inset-0 h-5 w-5 text-amber-400 transition-all duration-500 ${theme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
        />
        <Moon
          weight="fill"
          className={`absolute inset-0 h-5 w-5 text-(--db-primary) transition-all duration-500 ${theme === "light" ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`}
        />
      </div>
    </button>
  );
}
