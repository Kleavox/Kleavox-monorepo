//app/admin/delete/page.tsx

"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DeauBitLogo from "@/components/DeauBitLogo";
import { Trash2, CheckCircle2, Loader2, XCircle } from "lucide-react";

function DeleteContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"confirm" | "loading" | "success" | "error">("confirm");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleConfirm() {
    if (!slug || !token) return;
    setStatus("loading");

    try {
        const res = await fetch("/api/admin/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug, token }),
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to delete");
        setStatus("success");
    } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Unknown error");
    }
  }

  if (!slug || !token) {
      return <div className="text-red-500 font-bold">Invalid Link Parameters</div>;
  }

  return (
    <div className="w-full max-w-md bg-(--db-surface) border-4 border-(--db-border) shadow-[12px_12px_0px_0px_var(--db-border)] p-8 text-center">
        
        <div className="flex justify-center mb-6">
            <DeauBitLogo size={50} />
        </div>

        {status === "confirm" && (
            <>
                <div className="inline-flex p-4 bg-red-100 border-4 border-(--db-border) rounded-full mb-6 text-red-600">
                    <Trash2 className="h-12 w-12" />
                </div>
                <h1 className="text-2xl font-black uppercase text-(--db-text) mb-2">CONFIRM DELETION</h1>
                <p className="text-sm font-bold text-(--db-text-muted) mb-6">
                    You are about to delete the link <span className="bg-yellow-200 px-1 text-black">/{slug}</span> based on an abuse report.
                </p>
                <button 
                    onClick={handleConfirm}
                    className="w-full bg-red-600 text-white py-4 font-black uppercase border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                    DELETE LINK NOW
                </button>
            </>
        )}

        {status === "loading" && (
            <div className="py-10 flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-(--db-primary)" />
                <p className="font-bold uppercase">Processing...</p>
            </div>
        )}

        {status === "success" && (
            <div className="animate-in zoom-in-95">
                <div className="inline-flex p-4 bg-green-100 border-4 border-(--db-border) rounded-full mb-6 text-green-600">
                    <CheckCircle2 className="h-12 w-12" />
                </div>
                <h1 className="text-2xl font-black uppercase text-(--db-text) mb-2">LINK DESTROYED</h1>
                <p className="text-sm font-bold text-(--db-text-muted)">The link has been permanently removed from Database & Cache.</p>
            </div>
        )}

        {status === "error" && (
            <div>
                <div className="inline-flex p-4 bg-red-100 border-4 border-(--db-border) rounded-full mb-6 text-red-600">
                    <XCircle className="h-12 w-12" />
                </div>
                <h1 className="text-2xl font-black uppercase text-(--db-text) mb-2">ERROR</h1>
                <p className="text-sm font-bold text-red-600 mb-4">{errorMsg}</p>
                <p className="text-xs text-(--db-text-muted)">The link might have been deleted already.</p>
            </div>
        )}

    </div>
  );
}

export default function AdminDeletePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-(--db-bg)">
       <Suspense fallback={<div>Loading...</div>}>
          <DeleteContent />
       </Suspense>
    </div>
  );
}
