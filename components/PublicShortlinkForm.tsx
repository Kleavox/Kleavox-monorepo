//components/PublicShortlinkForm.tsx

"use client";

import { useState } from "react";
import { Loader2, Link2 } from "lucide-react";
import type { ShortlinkResult, PublicLinkResponse } from "@/types";
import ShortlinkResultModal from "./ShortlinkResultModal";
import Link from "next/link";
import { Turnstile } from "@marsidev/react-turnstile";

export default function PublicShortlinkForm() {
    const [publicTarget, setPublicTarget] = useState("");
    const [publicLoading, setPublicLoading] = useState(false);
    const [publicError, setPublicError] = useState<string | null>(null);
    const [publicResult, setPublicResult] = useState<ShortlinkResult | null>(null);
    
    const [turnstileToken, setTurnstileToken] = useState("");

    async function handlePublicSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        
        if (!turnstileToken) {
            setPublicError("Please complete the security check.");
            return;
        }

        setPublicLoading(true); setPublicError(null); setPublicResult(null);

        try {
            const res = await fetch("/api/public-links", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    targetUrl: publicTarget,
                    cfTurnstile: turnstileToken
                }),
            });

            const data: PublicLinkResponse = await res.json().catch(() => ({} as PublicLinkResponse));

            if (!res.ok) {
                if (res.status === 400 || res.status === 429) {
                    setTurnstileToken(""); 
                }
                throw new Error(
                    typeof data.error === "string"
                        ? data.error
                        : "Failed to create link."
                );
            }

            if (typeof data.shortUrl !== "string") {
                throw new Error("Failed to create link.");
            }

            const slug = data.shortUrl.split("/").pop() ?? "";
            setPublicResult({ slug, shortUrl: data.shortUrl });
            setPublicTarget("");
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Failed to create link.";
            setPublicError(msg);
        } finally {
            setPublicLoading(false);
        }
    }

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 border-b-4 border-(--db-border) pb-2 text-(--db-text)">
                    <Link2 className="h-6 w-6" />
                    <h3 className="text-xl font-black uppercase">Quick Shorten</h3>
                </div>
                
                <p className="text-sm font-medium text-(--db-text-muted) mb-4">
                    Instant shorten without login (Expires: 1 Day).
                </p>

                <form className="space-y-4" onSubmit={handlePublicSubmit}>
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase bg-(--db-text) text-(--db-bg) px-2 py-0.5 inline-block">Target URL</label>
                        <input
                            className="w-full bg-(--db-bg) border-2 border-(--db-border) px-4 py-3 text-sm font-bold text-(--db-text) focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all placeholder:font-normal placeholder:text-(--db-text-muted)"
                            placeholder="https://..."
                            value={publicTarget}
                            onChange={(e) => setPublicTarget(e.target.value)}
                            required
                            autoComplete="off"
                        />
                    </div>

                    <div className={`overflow-hidden transition-all duration-300 ${turnstileToken ? 'h-0 opacity-0 my-0' : 'h-auto opacity-100 my-2'}`}>
                         <Turnstile 
                            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
                            onSuccess={(token) => setTurnstileToken(token)}
                            options={{ size: 'flexible', theme: 'auto' }}
                         />
                    </div>

                    {publicError && (
                        <div className="bg-(--db-danger) text-white p-2 text-xs font-bold border-2 border-(--db-border) flex items-center gap-2">
                             <span>!</span> {publicError}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={publicLoading || !turnstileToken}
                        className="w-full bg-(--db-text) text-(--db-bg) py-3 font-black text-sm uppercase border-2 border-(--db-border) hover:bg-(--db-primary) hover:text-white hover:shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {publicLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto"/> : "SHORTEN NOW"}
                    </button>

                    <p className="text-[10px] text-center font-bold text-(--db-text-muted) leading-tight">
                        By using this service, you agree to our <Link href="/terms" target="_blank" className="underline hover:text-(--db-text)">Terms</Link> & <Link href="/privacy" target="_blank" className="underline hover:text-(--db-text)">Privacy Policy</Link>.
                    </p>
                </form>
            </div>

            {publicResult && (
                <ShortlinkResultModal
                    result={publicResult}
                    onClose={() => setPublicResult(null)}
                />
            )}
        </>
    );
}
