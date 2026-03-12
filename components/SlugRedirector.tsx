//components/SlugRedirector.tsx

"use client";

import { useEffect, useState } from "react";

export default function SlugRedirector({ target, delay = 5 }: { target: string; delay?: number }) {
  const [timeLeft, setTimeLeft] = useState(delay);

  useEffect(() => {
    if (!target) return;
    if (timeLeft <= 0) { window.location.href = target; return; }
    const timer = setInterval(() => setTimeLeft((prev) => Math.max(0, prev - 0.1)), 100);
    return () => clearInterval(timer);
  }, [target, timeLeft]);

  const progressPercent = Math.min(100, Math.max(0, ((delay - timeLeft) / delay) * 100));

  return (
    <div className="w-full space-y-2">
      <div className="h-12 border-4 border-(--db-border) bg-(--db-bg) relative overflow-hidden shadow-[4px_4px_0px_0px_var(--db-border)]">
         <div 
            className="absolute top-0 left-0 h-full bg-(--db-primary) transition-all duration-100 ease-linear border-r-4 border-(--db-border)"
            style={{ width: `${progressPercent}%` }}
         />
         <div className="absolute inset-0 flex items-center justify-center z-10">
            <span className="font-black font-mono text-lg text-(--db-text) mix-blend-hard-light">
                {Math.ceil(timeLeft)}s
            </span>
         </div>
      </div>
    </div>
  );
}
