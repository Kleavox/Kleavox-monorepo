//app/verify/page.tsx

"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle, XCircle, ShieldCheck } from "lucide-react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"IDLE" | "SUCCESS" | "ERROR">("IDLE");
  const [msg, setMsg] = useState("");

  async function handleActivate() {
    if (!token) return;
    setLoading(true);
    
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("SUCCESS");
      } else {
        setStatus("ERROR");
        setMsg(data.error || "Verification failed");
      }
    } catch (e) {
      setStatus("ERROR");
      setMsg("Network error occurred");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center text-red-500">
        <XCircle className="w-12 h-12 mx-auto mb-2" />
        <p>Invalid Link</p>
      </div>
    );
  }

  if (status === "SUCCESS") {
    return (
      <div className="text-center space-y-4 animate-in fade-in zoom-in">
        <div className="inline-flex p-4 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
          <CheckCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Account Activated!</h2>
        <p className="text-gray-500 dark:text-gray-400">
          Your credentials have been sent to your email.<br/>
          Please check your inbox (and spam folder).
        </p>
        <button 
          onClick={() => router.push("/")}
          className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-6">
      <div className="inline-flex p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
        <ShieldCheck className="w-12 h-12" />
      </div>
      
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome to DeauVault</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">
          Click the button below to activate your account <br/> and generate your secure password.
        </p>
      </div>

      {status === "ERROR" && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm font-bold rounded-lg">
          {msg}
        </div>
      )}

      <button
        onClick={handleActivate}
        disabled={loading}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Activate Account"}
      </button>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-8">
        <Suspense fallback={<div className="text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto"/></div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
