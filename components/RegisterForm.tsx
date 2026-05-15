//components/RegisterForm.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleNotch, Envelope, UserCirclePlus, Check, Eye, EyeSlash, Warning, Key } from "@phosphor-icons/react";

export default function RegisterForm() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  async function performRegister() {
    setLoading(true);
    setError("");

    if (!agreed) { setError("AGREEMENT_REQUIRED"); setLoading(false); return; }
    if (formData.password !== confirmPassword) { setError("KEY_MISMATCH"); setLoading(false); return; }
    if (formData.password.length < 8) { setError("KEY_TOO_SHORT_MIN_8"); setLoading(false); return; }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "REGISTRY_FAILED");
      router.push(`/verify?email=${encodeURIComponent(formData.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "SYSTEM_ERROR");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performRegister();
  }

  return (
    <div className="w-full flex flex-col">
      <div className="flex items-center gap-4 mb-8 border-b border-(--db-border)/30 pb-6">
        <div className="bg-(--db-primary)/15 p-3 rounded-2xl shrink-0">
          <UserCirclePlus size={22} className="text-(--db-primary)" />
        </div>
        <div>
          <h2 className="text-xl nothing-title text-(--db-text)">REGISTER</h2>
          <p className="nothing-label text-[9px]">Initialize_New_Identity</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="nothing-label block ml-1 text-[9px]">Email_Identifier</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) pointer-events-none z-10">
              <Envelope size={17} />
            </div>
            <input
              type="email"
              className="db-input pl-10!"
              placeholder="NAME@DOMAIN.COM"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="nothing-label block ml-1 text-[9px]">Access_Key</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) pointer-events-none z-10">
              <Key size={17} />
            </div>
            <input
              type={showPassword ? "text" : "password"}
              className="db-input pl-10! pr-11!"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) hover:text-(--db-text) transition-colors p-0.5"
            >
              {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="nothing-label block ml-1 text-[9px]">Verify_Key</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-(--db-text-muted) pointer-events-none z-10 opacity-50">
              <Key size={17} />
            </div>
            <input
              type={showConfirmPassword ? "text" : "password"}
              className={`db-input pl-10! pr-11! ${confirmPassword && formData.password !== confirmPassword ? "border-red-500/50!" : ""}`}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {confirmPassword && formData.password === confirmPassword && (
                <Check size={16} className="text-(--db-primary)" />
              )}
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="text-(--db-text-muted) hover:text-(--db-text) transition-colors p-0.5"
              >
                {showConfirmPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 py-1">
          <input
            type="checkbox"
            id="terms_agree_register"
            className="mt-1 w-4 h-4 rounded accent-(--db-primary) cursor-pointer shrink-0"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <label htmlFor="terms_agree_register" className="text-[9px] font-bold uppercase text-(--db-text-muted) leading-tight cursor-pointer">
            I accept the <Link href="/terms" target="_blank" className="text-(--db-primary) hover:underline">Terms</Link> & <Link href="/privacy" target="_blank" className="text-(--db-primary) hover:underline">Privacy_Protocol</Link>.
          </label>
        </div>

        <button
          type="submit"
          disabled={loading || !agreed}
          className="btn-primary w-full py-3.5 text-xs tracking-widest mt-2 shadow-lg shadow-(--db-primary)/20 disabled:opacity-40"
        >
          {loading ? <CircleNotch size={20} className="animate-spin" /> : "INITIALIZE_ACCOUNT"}
        </button>

        {error && (
          <div className="bg-red-500/10 text-red-500 font-bold p-3 rounded-2xl border border-red-500/20 text-[9px] animate-error-shake flex items-center gap-3 uppercase tracking-widest">
            <Warning size={16} weight="fill" className="shrink-0" /> {error}
          </div>
        )}
      </form>

      <div className="mt-8 text-center pt-6 border-t border-(--db-border)/30">
        <span className="nothing-label text-[9px] mr-2">Authorized_Already?</span>
        <Link href="/" className="nothing-label text-[9px] text-(--db-primary) font-black border-b border-transparent hover:border-(--db-primary) transition-all">
          LOGIN_HERE
        </Link>
      </div>
    </div>
  );
}
