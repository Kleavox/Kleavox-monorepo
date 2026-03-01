//components/LoginForm.tsx

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, Mail, Eye, EyeOff, Terminal } from "lucide-react";
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
                    password
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
        <section className="h-full w-full">
            <div className="h-full flex flex-col justify-center border-4 border-[var(--db-border)] p-8 bg-[var(--db-surface)] shadow-[8px_8px_0px_0px_var(--db-border)] hover:shadow-[12px_12px_0px_0px_var(--db-border)] transition-all duration-300">
                
                <div className="flex items-center gap-4 mb-8 border-b-4 border-[var(--db-border)] pb-4">
                    <div className="bg-[var(--db-accent)] text-[var(--db-accent-fg)] p-3 border-2 border-[var(--db-border)]">
                        <Terminal className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter text-[var(--db-text)]">LOGIN AREA</h2>
                        <p className="text-xs font-bold text-[var(--db-text-muted)] uppercase tracking-widest">Secure Access</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="font-black text-sm uppercase tracking-wider mb-2 block text-[var(--db-text)]">
                            Email Address
                        </label>
                        <div className="relative group">
                            <input
                                type="email"
                                name="email"
                                autoComplete="username email"
                                className="w-full bg-[var(--db-bg)] border-2 border-[var(--db-border)] px-4 py-3 text-base font-bold text-[var(--db-text)] placeholder:font-normal placeholder:text-[var(--db-text-muted)] focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all"
                                placeholder="user@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <Mail className="absolute right-4 top-3.5 h-5 w-5 text-[var(--db-text-muted)] pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="font-black text-sm uppercase tracking-wider block text-[var(--db-text)]">Password</label>
                            <Link href="/forgot-password" className="text-xs font-bold text-[var(--db-primary)] hover:underline decoration-2">
                                Forgot Password?
                            </Link>
                        </div>
                        <div className="relative group">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                autoComplete="current-password"
                                className="w-full bg-[var(--db-bg)] border-2 border-[var(--db-border)] px-4 py-3 text-base font-bold text-[var(--db-text)] placeholder:font-normal placeholder:text-[var(--db-text-muted)] focus:outline-none focus:shadow-[4px_4px_0px_0px_var(--db-border)] transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-3.5 text-[var(--db-text-muted)] hover:text-[var(--db-text)] hover:scale-110 transition-transform cursor-pointer"
                                disabled={loading}
                            >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading || (cooldown !== null && cooldown > 0)}
                            className="w-full bg-[var(--db-primary)] text-[var(--db-primary-fg)] border-2 border-[var(--db-border)] py-4 font-black text-lg uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_var(--db-border)] active:translate-y-0 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <div className="bg-[var(--db-danger)] text-white font-bold p-3 border-2 border-[var(--db-border)] shadow-[4px_4px_0px_0px_var(--db-border)] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <span>❌</span> {error}
                        </div>
                    )}

                    {unverified && (
                        <div className="bg-[var(--db-accent)] text-[var(--db-accent-fg)] font-bold p-3 border-2 border-[var(--db-border)] shadow-[4px_4px_0px_0px_var(--db-border)] animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <p className="text-sm mb-2">Account not verified. Check your email for the confirmation code.</p>
                            <Link
                                href={`/verify?email=${encodeURIComponent(email)}`}
                                className="inline-block text-xs font-black uppercase tracking-wider bg-[var(--db-accent-fg)] text-[var(--db-accent)] px-3 py-1.5 border-2 border-[var(--db-border)] shadow-[2px_2px_0px_0px_var(--db-border)] hover:-translate-y-0.5 hover:shadow-[3px_3px_0px_0px_var(--db-border)] transition-all"
                            >
                                Verify your email →
                            </Link>
                        </div>
                    )}

                </form>

                <div className="mt-8 text-center pt-6 border-t-4 border-[var(--db-border)] border-dotted">
                    <span className="text-sm font-bold text-[var(--db-text-muted)]">Don't have an account? </span>
                    <Link href="/register" className="inline-block ml-1 text-sm font-black bg-[var(--db-accent)] text-[var(--db-accent-fg)] px-2 border-2 border-[var(--db-border)] hover:shadow-[2px_2px_0px_0px_var(--db-border)] hover:-translate-y-0.5 transition-all">
                        SIGNUP HERE
                    </Link>
                </div>
            </div>
        </section>
    );
}
