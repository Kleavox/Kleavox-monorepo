//components/ShortlinkResultModal.tsx

"use client";

import { useState } from "react";
import { Copy, X, Check, ArrowSquareOut, Link as LinkIcon, ShieldCheck, Activity } from "@phosphor-icons/react";
import type { ShortlinkResult } from "@/types";

interface ShortlinkResultModalProps { result: ShortlinkResult; onClose: () => void; }

export default function ShortlinkResultModal({ result, onClose }: ShortlinkResultModalProps) {
  const [copied, setCopied] = useState(false);

  async function copyShortUrl() {
    if (!result?.shortUrl) return;
    try {
      await navigator.clipboard.writeText(result.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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
    <div className="fixed inset-0 z-100 flex items-center justify-center px-4 sm:px-6 bg-(--db-bg)/95 backdrop-blur-2xl animate-reveal">
      <div className="w-full max-w-2xl db-card p-1 lg:p-1.5 animate-reveal relative border-(--db-primary)/30 overflow-hidden shadow-[0_0_80px_rgba(163,230,53,0.08)]">

        <div className="absolute inset-0 opacity-[0.025] pointer-events-none overflow-hidden select-none">
          <div className="absolute top-0 left-0 w-full h-full font-dot text-[8px] leading-none break-all animate-pulse">
            {Array(20).fill("01011010011010101101010100101010110").join(" ")}
          </div>
        </div>

        <div className="bg-(--db-surface) rounded-3xl p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-8">

          <div className="flex flex-col items-center text-center space-y-5 shrink-0">
            <div className="relative">
              <div className="p-6 sm:p-8 bg-(--db-primary)/15 text-(--db-primary) rounded-4xl border border-(--db-primary)/10">
                <LinkIcon size={40} className="animate-soft-pulse" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-(--db-bg) p-2 rounded-full border-2 border-(--db-primary)/20 text-green-500 shadow-xl">
                <ShieldCheck size={18} weight="fill" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Activity size={12} className="text-(--db-primary) animate-pulse" />
                <span className="nothing-label text-[9px] text-(--db-primary) opacity-100">NODE_ACTIVE</span>
              </div>
              <p className="nothing-label text-[8px] opacity-30 uppercase">Encrypted_Payload</p>
            </div>
          </div>

          <div className="flex-1 w-full space-y-6 sm:space-y-8">
            <div className="space-y-2">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl nothing-title text-(--db-text)">LINK_READY</h3>
              <p className="nothing-label text-[10px] tracking-[0.2em] opacity-50">RELATIONAL_ACCESS_IDENTIFIER</p>
            </div>

            <div className="relative group w-full">
              <div className="bg-(--db-surface-hover) border border-(--db-border) p-5 rounded-3xl transition-all group-hover:border-(--db-primary)/30">
                <div className="nothing-label text-[8px] absolute -top-2.5 left-5 bg-(--db-surface) px-2 text-(--db-primary) font-bold">SECURE_LINK</div>
                <p
                  data-shorturl
                  className="font-dot text-lg sm:text-xl lg:text-2xl break-all text-(--db-text) tracking-tighter leading-none"
                >
                  {result.shortUrl.replace(/^https?:\/\//, '')}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={copyShortUrl}
                className={`flex-1 py-3.5 btn-primary text-[9px] tracking-[0.2em] transition-all whitespace-nowrap ${copied ? 'bg-green-500!' : ''}`}
              >
                {copied ? <><Check size={14} /> COPIED_OK</> : <><Copy size={14} /> COPY_ADDRESS</>}
              </button>

              <a
                href={result.shortUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-3.5 btn-secondary text-[9px] tracking-[0.2em] transition-all whitespace-nowrap"
              >
                <ArrowSquareOut size={14} /> OPEN_RESOURCE
              </a>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-(--db-surface-hover) transition-colors opacity-30 hover:opacity-100 group"
        >
          <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>
    </div>
  );
}
