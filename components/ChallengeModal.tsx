//components/ChallengeModal.tsx

"use client";

import { Turnstile } from "@marsidev/react-turnstile";
import { ShieldCheck, X, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

interface ChallengeModalProps {
    onSuccess: (token: string) => void;
    onClose: () => void;
}

export default function ChallengeModal({ onSuccess, onClose }: ChallengeModalProps) {
    const [verifying, setVerifying] = useState(false);
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    useEffect(() => {
        if (!siteKey) {
            console.error("❌ [Turnstile] NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing from environment variables!");
        }
    }, [siteKey]);

    const handleSuccess = (token: string) => {
        setVerifying(true);
        setTimeout(() => {
            onSuccess(token);
        }, 500);
    };

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center px-4 bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="db-card w-full max-w-sm p-8 space-y-6 animate-success-pop">
                
                <div className="flex items-center justify-between border-b-4 border-(--db-border) pb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-(--db-primary) p-2 border-2 border-(--db-border)">
                            <ShieldCheck className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase tracking-tighter text-(--db-text)">Verification</h3>
                            <p className="text-[10px] font-bold text-(--db-text-muted) uppercase">Confirm you are human</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="border-2 border-(--db-border) p-1 hover:bg-(--db-danger) hover:text-white transition-all active:translate-y-0.5">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="py-4 flex flex-col items-center justify-center min-h-32">
                    {!siteKey ? (
                        <div className="flex flex-col items-center gap-2 text-(--db-danger) text-center p-4 border-2 border-dashed border-(--db-danger)">
                            <AlertCircle className="h-8 w-8" />
                            <p className="text-xs font-black uppercase">Configuration Error</p>
                            <p className="text-[10px] font-bold opacity-70">SITE KEY MISSING</p>
                        </div>
                    ) : verifying ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-(--db-primary)" />
                            <p className="font-black text-xs uppercase tracking-widest animate-pulse">Verifying...</p>
                        </div>
                    ) : (
                        <div className="border-4 border-(--db-border) p-2 bg-white rounded-sm overflow-hidden">
                            <Turnstile 
                                siteKey={siteKey} 
                                onSuccess={handleSuccess}
                                options={{ theme: 'light', size: 'normal' }}
                            />
                        </div>
                    )}
                </div>

                <div className="text-center">
                    <p className="text-[10px] font-bold text-(--db-text-muted) leading-tight px-4 uppercase">
                        {siteKey ? "This security check helps prevent automated spam and keeps DeauBit fast for everyone." : "Please contact the administrator to fix the security configuration."}
                    </p>
                </div>

            </div>
        </div>
    );
}
