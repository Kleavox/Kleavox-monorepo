//app/page.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Upload, Info } from "lucide-react";
import FileUploader from "@/components/FileUploader";

export default function LandingPage() {
  const [mode, setMode] = useState<"GUEST" | "LOGIN">("GUEST");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      router.push("/dash");
      router.refresh(); 
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        
        <div className="flex border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setMode("GUEST")}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              mode === "GUEST" 
                ? "text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 border-b-2 border-indigo-600" 
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            <Upload className="w-4 h-4" /> Guest Upload
          </button>
          <button
            onClick={() => setMode("LOGIN")}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              mode === "LOGIN" 
                ? "text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 border-b-2 border-indigo-600" 
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            }`}
          >
            <Lock className="w-4 h-4" /> Member Login
          </button>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black tracking-tighter mb-2">DeauVault</h1>
            <p className="text-sm text-gray-500 font-medium">
              {mode === "GUEST" 
                ? "Instant Public Storage (1GB Limit)" 
                : "Secure Admin & User Access"}
            </p>
          </div>

          {mode === "GUEST" ? (
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p>Guest files are public and will be automatically deleted after <strong>1 hour</strong>.</p>
              </div>
              <FileUploader onUploadSuccess={() => {
                alert("File uploaded! Since you are a guest, please save the file link immediately.");
              }} />
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5 animate-in fade-in zoom-in duration-300">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  placeholder="name@deauport.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold rounded-lg text-center border border-red-200 dark:border-red-800">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Access Vault"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
