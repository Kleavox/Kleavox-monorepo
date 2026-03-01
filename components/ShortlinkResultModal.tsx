//components/ShortlinkResultModal.tsx

"use client";

import { useState } from "react";
import { Copy, X, CheckCircle2, Check } from "lucide-react";
import type { ShortlinkResult } from "@/types";

interface ShortlinkResultModalProps { result: ShortlinkResult; onClose: () => void; }

export default function ShortlinkResultModal({ result, onClose }: ShortlinkResultModalProps) {
  const [copied, setCopied] = useState(false);

  async function copyShortUrl() {
    if (!result?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text for manual copy
      const el = document.querySelector("[data-shorturl]") as HTMLElement | null;
      if (el) {
        const range = document.createRange();
        range.selectNode(el);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md bg-[var(--db-surface)] border-4 border-[var(--db-border)] shadow-[12px_12px_0px_0px_var(--db-border)] p-6 space-y-5">
        <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase flex items-center gap-2 text-[var(--db-success)]">
                <CheckCircle2 className="h-6 w-6"/> SUCCESS!
            </h3>
            <button onClick={onClose} className="border-2 border-[var(--db-border)] p-1 hover:bg-[var(--db-bg)]"><X className="h-5 w-5 text-[var(--db-text)]"/></button>
        </div>

        <div className="bg-[var(--db-bg)] border-2 border-[var(--db-border)] p-4">
            <p data-shorturl className="font-mono text-sm break-all font-bold text-[var(--db-text)] text-center">{result.shortUrl}</p>
        </div>

        <div className="flex gap-3">
            <button
              onClick={copyShortUrl}
              className={`flex-1 py-3 font-black border-2 border-[var(--db-border)] hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2 ${
                copied
                  ? "bg-[var(--db-success)] text-white"
                  : "bg-[var(--db-accent)] text-black"
              }`}
            >
              {copied ? <><Check className="h-4 w-4"/> COPIED!</> : <><Copy className="h-4 w-4"/> COPY</>}
            </button>
            <a href={result.shortUrl} target="_blank" rel="noreferrer" className="flex-1 py-3 font-black border-2 border-[var(--db-border)] bg-[var(--db-text)] text-[var(--db-bg)] hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all text-center">
                OPEN LINK
            </a>
        </div>
      </div>
    </div>
  );
}
