//app/admin/delete/page.tsx

"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Trash, CheckCircle, CircleNotch, XCircle, Warning } from "@phosphor-icons/react";

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
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="p-5 bg-(--db-danger)/10 text-(--db-danger) rounded-3xl">
          <Warning size={32} weight="fill" />
        </div>
        <p className="nothing-label text-(--db-danger) opacity-100">INVALID_PARAMETERS</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-center">
      {status === "confirm" && (
        <>
          <div className="inline-flex p-6 bg-(--db-danger)/10 text-(--db-danger) rounded-3xl animate-soft-pulse">
            <Trash size={36} />
          </div>
          <div className="space-y-2">
            <p className="nothing-label text-(--db-danger) opacity-100">ABUSE_RESPONSE_MODULE</p>
            <h1 className="nothing-title text-2xl text-(--db-text)">CONFIRM_DELETION</h1>
          </div>
          <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px] leading-relaxed max-w-xs mx-auto">
            You are about to permanently terminate{" "}
            <span className="font-dot text-(--db-danger) font-bold">/{slug}</span>{" "}
            based on an abuse report. This action is irreversible.
          </p>
          <button onClick={handleConfirm} className="btn-danger w-full py-4 text-xs tracking-[0.2em] shadow-lg shadow-(--db-danger)/20">
            <Trash size={16} /> CONFIRM_PURGE
          </button>
        </>
      )}

      {status === "loading" && (
        <div className="flex flex-col items-center gap-6 py-8 opacity-50">
          <CircleNotch size={44} className="animate-spin text-(--db-primary)" />
          <span className="nothing-label animate-pulse">EXECUTING_PURGE...</span>
        </div>
      )}

      {status === "success" && (
        <div className="animate-reveal space-y-6">
          <div className="inline-flex p-6 bg-(--db-primary)/15 text-(--db-primary) rounded-3xl">
            <CheckCircle size={36} weight="fill" />
          </div>
          <div className="space-y-2">
            <p className="nothing-label text-(--db-primary) opacity-100">OPERATION_COMPLETE</p>
            <h1 className="nothing-title text-2xl text-(--db-text)">NODE_TERMINATED</h1>
          </div>
          <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px]">
            The link has been permanently removed from database and cache.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="animate-reveal space-y-6">
          <div className="inline-flex p-6 bg-(--db-danger)/10 text-(--db-danger) rounded-3xl">
            <XCircle size={36} weight="fill" />
          </div>
          <div className="space-y-2">
            <p className="nothing-label text-(--db-danger) opacity-100">OPERATION_FAILED</p>
            <h1 className="nothing-title text-2xl text-(--db-text)">ERROR</h1>
          </div>
          <p className="text-sm font-bold text-(--db-danger)">{errorMsg}</p>
          <p className="nothing-label normal-case tracking-normal opacity-40 text-[10px]">The link may have already been removed.</p>
        </div>
      )}
    </div>
  );
}

export default function AdminDeletePage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-12 bg-(--db-bg)">
      <div className="db-card w-full max-w-sm p-10 shadow-2xl animate-reveal border-(--db-border)">
        <Suspense fallback={
          <div className="flex items-center justify-center py-10 opacity-40">
            <CircleNotch size={32} className="animate-spin text-(--db-primary)" />
          </div>
        }>
          <DeleteContent />
        </Suspense>
      </div>
    </div>
  );
}
