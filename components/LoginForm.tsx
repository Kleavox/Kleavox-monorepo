//components/LoginForm.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Loader2, Mail, Eye, EyeOff, Terminal } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { LoginResponse } from "@/types";

interface LoginFormProps {
    nextPath?: string;
}

export default function LoginForm({ nextPath = "/dash" }: LoginFormProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [unverified, setUnverified] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cooldown, setCooldown] = useState<number | null>(null);
    const [turnstileToken, setTurnstileToken] = useState("");
    const turnstileRef = useRef<TurnstileInstance>(null);

    useEffect(() => {
        if (cooldown === null) return;
        if (cooldown <= 0) { setCooldown(null); return; }
        const id = setInterval(() => setCooldown((prev) => (prev === null || prev <= 1 ? null : prev - 1)), 1000);
        return () => clearInterval(id);
    }, [cooldown]);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (cooldown !== null && cooldown > 0) return;
        
        setLoading(true); setError(null); setUnverified(false);

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    email, 
                    password,
                    cfTurnstile: turnstileToken
                }),
            });
            const data: LoginResponse = await res.json().catch(() => ({}));

            if (res.status === 429) {
                const retry = typeof data.retryAfter === "number" ? data.retryAfter : 60;
                setCooldown(retry);
                setError(`Too many attempts. Wait ${retry}s.`);
                return;
            }

            if (res.status === 403) {
                setUnverified(true);
                return;
            }
            
            if (!res.ok) {
                if (res.status === 400 && data.error?.includes("Security")) {
                    turnstileRef.current?.reset();
                    setTurnstileToken("");
                }
                throw new Error(typeof data.error === "string" ? data.error : "Login failed");
            }
            
            window.location.href = nextPath;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <section className="h-full w-full flex items-center justify-center">
            <div className="db-card w-full max-w-md p-8 shadow-[12px_12px_0px_0px_var(--db-border)] hover:shadow-[16px_16px_0px_0px_var(--db-border)] animate-in fade-in slide-in-from-bottom-8 duration-700">
                
                <div className="flex items-center gap-4 mb-8 border-b-4 border-(--db-border) pb-4">
                    <div className="bg-(--db-accent) text-(--db-accent-fg) p-3 border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)]">
                        <Terminal className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-(--db-text)">LOGIN AREA</h2>
                        <p className="text-xs font-bold text-(--db-text-muted) uppercase tracking-widest">Secure Access</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="font-black text-sm uppercase tracking-wider mb-2 block text-(--db-text)">
                            Email Address
                        </label>
                        <div className="relative group">
                            <input
                                type="email"
                                name="email"
                                autoComplete="username email"
                                className="w-full bg-(--db-bg) border-2 border-(--db-border) px-4 py-3 text-base font-bold text-(--db-text) placeholder:font-normal placeholder:text-(--db-text-muted) db-input-focus"
                                placeholder="user@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <Mail className="absolute right-4 top-3.5 h-5 w-5 text-(--db-text-muted) pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-black text-sm uppercase tracking-wider block text-(--db-text)">Password</label>
                            <Link href="/forgot-password" className="text-xs font-bold text-(--db-primary) hover:underline decoration-2 hover:scale-105 transition-transform inline-block">
                                Forgot Password?
                            </Link>
                        </div>
                        <div className="relative group">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                autoComplete="current-password"
                                className="w-full bg-(--db-bg) border-2 border-(--db-border) px-4 py-3 text-base font-bold text-(--db-text) placeholder:font-normal placeholder:text-(--db-text-muted) db-input-focus"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-3.5 text-(--db-text-muted) hover:text-(--db-text) hover:scale-125 transition-transform cursor-pointer"
                                disabled={loading}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div className={`overflow-hidden transition-all duration-300 ${turnstileToken ? 'h-0 opacity-0 my-0' : 'h-auto opacity-100 my-4'}`}>
                        <Turnstile 
                            ref={turnstileRef}
                            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
                            onSuccess={(token) => setTurnstileToken(token)}
                            options={{ size: 'flexible', theme: 'auto' }}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading || (cooldown !== null && cooldown > 0) || !turnstileToken}
                            className="w-full bg-(--db-primary) text-(--db-primary-fg) border-2 border-(--db-border) py-4 font-black text-lg uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_var(--db-border)] hover:scale-[1.02] active:scale-[0.98] active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2"><Loader2 className="animate-spin h-5 w-5"/> Loading...</span>
                            ) : cooldown ? (
                                `Wait (${cooldown}s)`
                            ) : (
                                "LOGIN NOW"
                            )}
                        </button>
                    </div>
                    
                    {error && (
                        <div className="bg-(--db-danger) text-white font-bold p-3 border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 animate-error-shake duration-300">
                            <span>❌</span> {error}
                        </div>
                    )}

                    {unverified && (
                        <div className="bg-(--db-accent) text-(--db-accent-fg) font-bold p-3 border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)] animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <p className="text-sm mb-2">Account not verified. Check your email for the confirmation code.</p>
                            <Link
                                href={`/verify?email=${encodeURIComponent(email)}`}
                                className="inline-block text-xs font-black uppercase tracking-wider bg-(--db-accent-fg) text-(--db-accent) px-3 py-1.5 border-2 border-(--db-border) shadow-[2px_2px_0px_0px_var(--db-border)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_var(--db-border)] transition-all"
                            >
                                Verify your email →
                            </Link>
                        </div>
                    )}

                </form>

                <div className="mt-8 text-center pt-6 border-t-4 border-(--db-border) border-dotted">
                    <span className="text-sm font-bold text-(--db-text-muted)">Don&apos;t have an account? </span>
                    <Link href="/register" className="inline-block ml-1 text-sm font-black bg-(--db-accent) text-(--db-accent-fg) px-2 border-2 border-(--db-border) hover:shadow-[2px_2px_0px_0px_var(--db-border)] hover:-translate-y-0.5 transition-all">
                        SIGNUP HERE
                    </Link>
                </div>
            </div>
        </section>
    );
}
