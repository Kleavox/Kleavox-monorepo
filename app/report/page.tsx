//app/report/page.tsx

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DeauBitLogo from "@/components/DeauBitLogo";
import { AlertTriangle, Send, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ReportPage() {
  const [formData, setFormData] = useState({
    linkUrl: "",
    reason: "phishing",
    details: "",
    contact: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  
  const [placeholder, setPlaceholder] = useState("https://...");

  useEffect(() => {
    const protocol = process.env.NEXT_PUBLIC_PROTOCOL || "https";
    const host = process.env.NEXT_PUBLIC_SHORT_HOST || process.env.NEXT_PUBLIC_APP_HOST;
    
    if (host) {
        setPlaceholder(`${protocol}://${host}/...`);
    } else if (typeof window !== "undefined") {
        setPlaceholder(`${window.location.origin}/...`);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit report.");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-(--db-bg)">
            <div className="w-full max-w-md bg-(--db-surface) border-4 border-(--db-border) p-8 shadow-[12px_12px_0px_0px_var(--db-border)] text-center animate-in zoom-in-95">
                <div className="inline-flex p-4 bg-(--db-success) border-4 border-(--db-border) rounded-full mb-6 shadow-[4px_4px_0px_0px_var(--db-border)]">
                    <CheckCircle2 className="h-12 w-12 text-white" />
                </div>
                <h2 className="text-2xl font-black uppercase text-(--db-text) mb-2">REPORT SENT</h2>
                <p className="text-sm font-bold text-(--db-text-muted) mb-8">
                    Thank you for keeping the internet safe. We will review your report immediately.
                </p>
                <Link href="/" className="block w-full bg-(--db-text) text-(--db-bg) py-4 font-black uppercase border-2 border-(--db-border) hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all">
                    BACK TO HOME
                </Link>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-(--db-bg)">
      <div className="mb-8">
         <DeauBitLogo size={50} />
      </div>

      <div className="w-full max-w-lg bg-(--db-surface) border-4 border-(--db-border) p-6 md:p-8 shadow-[12px_12px_0px_0px_var(--db-border)]">
        
        <div className="flex items-center gap-3 mb-6 border-b-4 border-(--db-border) pb-4">
            <div className="bg-(--db-danger) p-2 border-2 border-(--db-border) text-white shadow-[2px_2px_0px_0px_var(--db-border)]">
                <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black uppercase text-(--db-text)">REPORT ABUSE</h1>
        </div>

        <p className="text-sm font-bold text-(--db-text-muted) mb-6">
            Found a malicious link using our service? Please report it below.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
                <label className="font-black text-xs uppercase mb-1 block text-(--db-text)">Suspicious Link URL</label>
                <input 
                    type="url" 
                    className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all"
                    placeholder={placeholder}
                    value={formData.linkUrl}
                    onChange={e => setFormData({...formData, linkUrl: e.target.value})}
                    required
                />
            </div>

            <div>
                <label className="font-black text-xs uppercase mb-1 block text-(--db-text)">Reason</label>
                <div className="relative">
                    <select 
                        className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all appearance-none cursor-pointer"
                        value={formData.reason}
                        onChange={e => setFormData({...formData, reason: e.target.value})}
                    >
                        <option value="phishing">Phishing / Scam</option>
                        <option value="malware">Malware / Virus</option>
                        <option value="spam">Spam / Advertising</option>
                        <option value="violence">Violence / Hate Speech</option>
                        <option value="other">Other</option>
                    </select>
                    <div className="absolute right-3 top-3.5 pointer-events-none text-(--db-text)">▼</div>
                </div>
            </div>

            <div>
                <label className="font-black text-xs uppercase mb-1 block text-(--db-text)">Additional Details (Optional)</label>
                <textarea 
                    className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-medium text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all min-h-20"
                    placeholder="Describe the issue..."
                    value={formData.details}
                    onChange={e => setFormData({...formData, details: e.target.value})}
                />
            </div>

            <div>
                <label className="font-black text-xs uppercase mb-1 block text-(--db-text)">Your Email (Optional)</label>
                <input 
                    type="email" 
                    className="w-full bg-(--db-bg) border-2 border-(--db-border) p-3 font-bold text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all"
                    placeholder="For follow-up if needed"
                    value={formData.contact}
                    onChange={e => setFormData({...formData, contact: e.target.value})}
                />
            </div>

            {error && (
                <div className="bg-(--db-danger) text-white font-bold p-3 border-2 border-(--db-border) text-xs">
                    ❌ {error}
                </div>
            )}

            <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-(--db-danger) text-white border-2 border-(--db-border) py-4 font-black uppercase tracking-widest hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 className="animate-spin h-5 w-5"/> : <><Send className="h-4 w-4"/> SUBMIT REPORT</>}
            </button>
        </form>

        <div className="mt-6 pt-4 border-t-2 border-dashed border-(--db-border) text-center">
            <Link href="/" className="inline-flex items-center gap-1 font-bold text-xs text-(--db-text-muted) hover:text-(--db-text) hover:underline">
                <ArrowLeft className="h-3 w-3" /> Cancel & Return Home
            </Link>
        </div>

      </div>
    </div>
  );
}
