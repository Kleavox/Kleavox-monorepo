// app/reset-password/page.tsx

"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DeauBitLogo from "@/components/DeauBitLogo";
import { Loader2, CheckCircle2, Eye, EyeOff, Check } from "lucide-react";

function ResetContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("idle");
    
    if (password !== confirmPassword) {
        setStatus("error");
        setMsg("Passwords do not match.");
        setLoading(false);
        return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setStatus("success");
      setTimeout(() => router.push("/"), 2000);
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="bg-(--db-danger) text-white border-4 border-(--db-border) p-6 font-bold text-center shadow-[8px_8px_0px_0px_var(--db-border)]">
        INVALID LINK (MISSING TOKEN)
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="text-center space-y-4">
        <div className="inline-flex p-4 bg-(--db-success) border-4 border-(--db-border) rounded-full shadow-[4px_4px_0px_0px_var(--db-border)] animate-in zoom-in-50 duration-300">
           <CheckCircle2 className="h-10 w-10 text-white" />
        </div>
        <h3 className="text-2xl font-black uppercase text-(--db-text)">Password Updated!</h3>
        <p className="text-(--db-text-muted) font-bold">Redirecting to login...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      
      <div>
        <label className="font-black text-xs uppercase mb-2 block text-(--db-text)">New Password</label>
        <div className="relative">
          <input 
            type={showPassword ? "text" : "password"} 
            className="w-full bg-(--db-bg) border-2 border-(--db-border) p-4 pr-12 font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:text-(--db-text-muted)" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            placeholder="Min. 6 chars"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-4 text-(--db-text-muted) hover:text-(--db-text)"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div>
        <label className="font-black text-xs uppercase mb-2 block text-(--db-text)">Re-enter Password</label>
        <div className="relative">
          <input 
            type={showConfirmPassword ? "text" : "password"} 
            className={`w-full bg-(--db-bg) border-2 border-(--db-border) p-4 pr-12 font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:text-(--db-text-muted) ${
                confirmPassword && password !== confirmPassword ? "border-red-500" : ""
            }`}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm password"
            autoComplete="new-password"
          />
          
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {confirmPassword && password === confirmPassword && (
                <Check className="h-5 w-5 text-green-500" />
            )}
            <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-(--db-text-muted) hover:text-(--db-text)"
            >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {status === "error" && (
        <div className="bg-(--db-danger) text-white font-bold p-3 border-2 border-(--db-border) text-sm shadow-[4px_4px_0px_0px_var(--db-border)]">
            ❌ {msg}
        </div>
      )}

      <button 
        type="submit"
        disabled={loading} 
        className="w-full bg-(--db-primary) text-(--db-primary-fg) py-4 font-black uppercase border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--db-border)] active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto"/> : "SET NEW PASSWORD"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <DeauBitLogo size={60} />
      </div>
      <div className="w-full max-w-md bg-(--db-surface) border-4 border-(--db-border) p-8 shadow-[12px_12px_0px_0px_var(--db-border)]">
        <h1 className="text-2xl font-black uppercase mb-6 text-(--db-text) text-center">Secure New Password</h1>
        <Suspense fallback={<div className="text-center font-bold animate-pulse">Loading...</div>}>
          <ResetContent />
        </Suspense>
      </div>
    </div>
  );
}
