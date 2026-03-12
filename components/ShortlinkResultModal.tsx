//components/ShortlinkResultModal.tsx

"use client";

import { useState } from "react";
import { Copy, X, CheckCircle2, Check, Star, PartyPopper } from "lucide-react";
import type { ShortlinkResult } from "@/types";

interface ShortlinkResultModalProps { result: ShortlinkResult; onClose: () => void; }

export default function ShortlinkResultModal({ result, onClose }: ShortlinkResultModalProps) {
  const [copied, setCopied] = useState(false);

  async function copyShortUrl() {
    if (!result?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 600);
    } catch {
      
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
      <div className="w-full max-w-md bg-(--db-surface) border-4 border-(--db-border) shadow-[12px_12px_0px_0px_var(--db-border)] p-6 space-y-5 animate-success-pop relative overflow-hidden">
        {}
        <div className="absolute top-2 left-2 text-(--db-accent) opacity-20 animate-bounce">
            <Star className="h-4 w-4 fill-current" />
        </div>
        <div className="absolute bottom-2 right-2 text-(--db-accent) opacity-20 animate-bounce delay-100">
            <Star className="h-4 w-4 fill-current" />
        </div>
        <div className="absolute top-10 right-4 text-(--db-success) opacity-20 animate-pulse">
            <PartyPopper className="h-6 w-6" />
        </div>

        <div className="flex items-center justify-between">
            <h3 className="text-xl font-black uppercase flex items-center gap-2 text-(--db-success)">
                <CheckCircle2 className="h-6 w-6"/> SUCCESS!
            </h3>
            <button onClick={onClose} className="border-2 border-(--db-border) p-1 hover:bg-(--db-bg)"><X className="h-5 w-5 text-(--db-text)"/></button>
        </div>

        <div className="bg-(--db-bg) border-2 border-(--db-border) p-4">
            <p data-shorturl className="font-mono text-sm break-all font-bold text-(--db-text) text-center">{result.shortUrl}</p>
        </div>

        <div className="flex gap-3">
            <button
              onClick={copyShortUrl}
              className={`flex-1 py-3 font-black border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2 ${
                copied
                  ? "animate-copy-flash bg-(--db-success) text-white"
                  : "bg-(--db-accent) text-black"
              }`}
            >
              {copied ? <><Check className="h-4 w-4"/> COPIED!</> : <><Copy className="h-4 w-4"/> COPY</>}
            </button>
            <a href={result.shortUrl} target="_blank" rel="noreferrer" className="flex-1 py-3 font-black border-2 border-(--db-border) bg-(--db-text) text-(--db-bg) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all text-center">
                OPEN LINK
            </a>
        </div>
      </div>
    </div>
  );
}
