//components/ShortlinkResultModal.tsx

"use client";

import { useState } from "react";
import { Copy, X, Check, ExternalLink, Link2, ShieldCheck, Activity } from "lucide-react";
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
    <div className="fixed inset-0 z-100 flex items-center justify-center px-6 bg-(--db-bg)/95 backdrop-blur-2xl animate-in fade-in duration-500">
      {/* Modal Container - Wider Layout (max-w-2xl) */}
      <div className="w-full max-w-2xl db-card p-1 lg:p-1.5 animate-reveal relative border-(--db-primary)/20 overflow-hidden shadow-[0_0_80px_rgba(234,21,6,0.08)]">
        
        {/* Animated Background Decoration (Techy Bits) */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden select-none">
            <div className="absolute top-0 left-0 w-full h-full font-dot text-[8px] leading-none break-all animate-pulse">
                {Array(20).fill("01011010011010101101010100101010110").join(" ")}
            </div>
        </div>

        <div className="bg-(--db-surface) rounded-3xl p-8 lg:p-12 flex flex-col md:flex-row items-center gap-10">
            
            {/* Left Side: Visual Node */}
            <div className="flex flex-col items-center text-center space-y-6 shrink-0">
                <div className="relative">
                    <div className="p-8 bg-(--db-primary)/10 text-(--db-primary) rounded-4xl border border-(--db-primary)/5">
                        <Link2 className="h-12 w-12 animate-soft-pulse" />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-(--db-bg) p-2 rounded-full border-2 border-(--db-primary)/20 text-green-500 shadow-xl">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="flex items-center justify-center gap-2">
                        <Activity className="h-3 w-3 text-(--db-primary) animate-pulse" />
                        <span className="nothing-label text-[9px] text-(--db-primary) font-bold">NODE_ACTIVE</span>
                    </div>
                    <p className="nothing-label text-[8px] opacity-40 uppercase">Encrypted_Payload_V9</p>
                </div>
            </div>

            {/* Right Side: Content & Actions */}
            <div className="flex-1 w-full space-y-8">
                <div className="space-y-2">
                    <h3 className="text-3xl lg:text-4xl nothing-title text-(--db-text)">LINK_READY</h3>
                    <p className="nothing-label text-[10px] tracking-[0.2em] opacity-60">RELATIONAL_ACCESS_IDENTIFIER</p>
                </div>

                {/* URL Display Node */}
                <div className="relative group w-full">
                    <div className="bg-(--db-surface-hover) border-2 border-(--db-border) p-6 rounded-3xl transition-all group-hover:border-(--db-text)/20">
                        <div className="nothing-label text-[8px] absolute -top-2.5 left-6 bg-(--db-bg) px-2 text-(--db-text) font-bold">SECURE_LINK</div>
                        <p 
                          data-shorturl 
                          className="font-dot text-xl lg:text-2xl break-all text-(--db-text) tracking-tighter leading-none"
                        >
                          {result.shortUrl.replace(/^https?:\/\//, '')}
                        </p>
                    </div>
                </div>

                {/* Action Controls */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={copyShortUrl}
                      className={`flex-1 py-4 btn-primary text-[10px] tracking-[0.3em] transition-all ${copied ? 'bg-green-600' : ''}`}
                    >
                      {copied ? (
                        <><Check className="h-4 w-4 animate-in zoom-in" /> COPIED_TO_CLIPBOARD</>
                      ) : (
                        <><Copy className="h-4 w-4" /> COPY_ADDRESS</>
                      )}
                    </button>
                    
                    <a 
                      href={result.shortUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="flex-1 py-4 btn-secondary text-[10px] tracking-[0.3em] border-2 border-(--db-border) hover:bg-(--db-text) hover:text-(--db-bg) transition-all"
                    >
                        <ExternalLink className="h-4 w-4 mr-2" /> OPEN_RESOURCE
                    </a>
                </div>
            </div>
        </div>

        {/* Close Button */}
        <button 
          onClick={onClose} 
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-(--db-surface-hover) transition-colors opacity-20 hover:opacity-100 group"
        >
          <X className="h-5 w-5 text-(--db-text) group-hover:rotate-90 transition-transform" />
        </button>
      </div>
    </div>
  );
}
