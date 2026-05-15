//app/not-found.tsx

"use client";

import Link from "next/link";
import { FileQuestion, ArrowLeft, House } from "@phosphor-icons/react";

export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4 sm:p-6 bg-(--db-bg)">
      <div className="db-card w-full max-w-md p-10 shadow-2xl text-center animate-reveal border-(--db-border)">

        <div className="inline-flex p-6 bg-(--db-primary)/15 text-(--db-primary) rounded-3xl mb-8 animate-soft-pulse">
          <FileQuestion size={44} />
        </div>

        <div className="space-y-3 mb-10">
          <p className="nothing-label text-(--db-primary) opacity-100">ERROR_404</p>
          <h1 className="nothing-title text-5xl text-(--db-text) animate-error-shake">NOT_FOUND</h1>
          <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px] leading-relaxed max-w-xs mx-auto pt-2">
            The node you requested may have been terminated, expired, or never existed in this system.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/" className="btn-primary w-full py-4 text-xs tracking-[0.2em] shadow-lg shadow-(--db-primary)/20">
            <House size={16} /> RETURN_TO_SYSTEM
          </Link>
          <button onClick={() => window.history.back()} className="btn-secondary w-full py-3 text-[10px] nothing-label opacity-100">
            <ArrowLeft size={14} /> PREVIOUS_NODE
          </button>
        </div>
      </div>
    </div>
  );
}
