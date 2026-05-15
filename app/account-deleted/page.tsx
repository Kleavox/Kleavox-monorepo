// app/account-deleted/page.tsx

"use client";

import DeauBitLogo from "@/components/DeauBitLogo";
import Link from "next/link";
import { UserMinus, ArrowRight, ShieldSlash } from "@phosphor-icons/react";

export default function AccountDeletedPage() {
  return (
    <div className="db-card w-full max-w-md p-10 text-center animate-reveal shadow-2xl border-(--db-border)">

      <div className="flex justify-center mb-8">
        <DeauBitLogo size={48} />
      </div>

      <div className="inline-flex p-6 bg-(--db-danger)/10 text-(--db-danger) rounded-3xl mb-8">
        <ShieldSlash size={40} className="animate-soft-pulse" />
      </div>

      <div className="space-y-3 mb-10">
        <h1 className="nothing-title text-3xl text-(--db-text)">ACCOUNT_TERMINATED</h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <UserMinus size={12} className="text-(--db-danger)" />
          <span className="nothing-label text-(--db-danger) text-[9px] opacity-100">Identity_Purged_Successfully</span>
        </div>
        <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px] leading-relaxed max-w-xs mx-auto pt-2">
          All associated data, shortlink mappings, and analytics records have been permanently removed from the system.
        </p>
      </div>

      <div className="space-y-3">
        <Link href="/" className="btn-primary w-full py-4 text-xs tracking-[0.2em] shadow-lg shadow-(--db-primary)/20">
          RETURN_TO_SYSTEM <ArrowRight size={16} />
        </Link>
        <Link href="/register" className="btn-secondary w-full py-3 text-[10px] nothing-label opacity-100">
          INITIALIZE_NEW_IDENTITY
        </Link>
      </div>
    </div>
  );
}
