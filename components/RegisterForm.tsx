//components/RegisterForm.tsx

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, FileSignature, Check, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

export default function RegisterForm() {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState(""); 
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [agreed, setAgreed] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>(""); 
  const router = useRouter();
  const turnstileRef = useRef<TurnstileInstance>(null);

  const isTurnstileDone = !!turnstileToken;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(""); 

    if (!agreed) {
        setError("You must agree to the Terms & Privacy Policy.");
        setLoading(false);
        return;
    }

    if (!turnstileToken) {
        setError("Please complete the security check.");
        setLoading(false);
        return;
    }

    if (formData.password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, cfTurnstile: turnstileToken }),
      });

      const data = await res.json();

      if (!res.ok) {
          if (res.status === 400 && data.error?.includes("Security")) {
             turnstileRef.current?.reset();
             setTurnstileToken("");
          }
          throw new Error(data.error || "Registration failed.");
      }

      router.push(`/verify?email=${encodeURIComponent(formData.email)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-full w-full py-8">
      <div className="db-card w-full max-w-lg p-8 shadow-[12px_12px_0px_0px_var(--db-border)] hover:shadow-[16px_16px_0px_0px_var(--db-border)] animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="flex items-center gap-3 mb-6 border-b-4 border-(--db-border) pb-3">
           <div className="bg-(--db-accent) p-2 border-2 border-(--db-border) shadow-[4px_4px_0px_0px_var(--db-border)]">
              <FileSignature className="h-5 w-5 text-(--db-accent-fg)"/>
           </div>
           <div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-(--db-text)">REGISTER</h2>
              <p className="text-[10px] font-bold text-(--db-text-muted) uppercase">Join the Club</p>
           </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          
          <div>
              <label className="font-black text-[10px] uppercase mb-1 block text-(--db-text)">Email</label>
              <div className="relative">
                  <input 
                      type="email" 
                      name="email"
                      autoComplete="username email"
                      className="w-full bg-(--db-bg) border-2 border-(--db-border) px-3 py-2 text-sm font-bold text-(--db-text) db-input-focus placeholder:font-normal placeholder:text-(--db-text-muted)" 
                      placeholder="name@example.com"
                      value={formData.email} 
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                      required 
                  />
                  <Mail className="absolute right-3 top-2.5 text-(--db-text-muted) w-4 h-4" />
              </div>
          </div>

          <div>
              <label className="font-black text-[10px] uppercase mb-1 block text-(--db-text)">Password</label>
              <div className="relative">
                  <input 
                      type={showPassword ? "text" : "password"} 
                      name="password"
                      autoComplete="new-password"
                      className="w-full bg-(--db-bg) border-2 border-(--db-border) px-3 py-2 text-sm font-bold text-(--db-text) db-input-focus placeholder:font-normal placeholder:text-(--db-text-muted) pr-10" 
                      placeholder="••••••••"
                      value={formData.password} 
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                      required 
                  />
                  <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-(--db-text-muted) hover:text-(--db-text) hover:scale-125 transition-transform"
                  >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
              </div>
          </div>

          <div>
              <label className="font-black text-[10px] uppercase mb-1 block text-(--db-text)">Re-enter Password</label>
              <div className="relative">
                  <input 
                      type={showConfirmPassword ? "text" : "password"} 
                      name="confirmPassword"
                      autoComplete="new-password"
                      className={`w-full bg-(--db-bg) border-2 border-(--db-border) px-3 py-2 text-sm font-bold text-(--db-text) db-input-focus placeholder:font-normal placeholder:text-(--db-text-muted) pr-10 ${
                          confirmPassword && formData.password !== confirmPassword ? "border-red-500 shadow-[4px_4px_0px_0px_rgba(239,68,68,0.4)]" : ""
                      }`}
                      placeholder="••••••••"
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      required 
                  />
                  
                  <div className="absolute right-3 top-2.5 flex items-center gap-2">
                      {confirmPassword && formData.password === confirmPassword && (
                          <Check className="text-green-500 w-4 h-4" />
                      )}
                      <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-(--db-text-muted) hover:text-(--db-text) hover:scale-125 transition-transform"
                      >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                  </div>
              </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
              <input 
                  type="checkbox" 
                  id="terms_agree_register" 
                  className="w-4 h-4 accent-(--db-primary) cursor-pointer shrink-0" 
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
              />
              <label htmlFor="terms_agree_register" className="text-[10px] font-bold text-(--db-text-muted) cursor-pointer select-none leading-tight">
                  I agree to the <Link href="/terms" target="_blank" className="underline hover:text-(--db-text)">Terms of Service</Link> & <Link href="/privacy" target="_blank" className="underline hover:text-(--db-text)">Privacy Policy</Link>.
              </label>
          </div>
          
          <div className={`overflow-hidden transition-all duration-300 ${isTurnstileDone ? 'h-0 opacity-0 my-0' : 'h-auto opacity-100 my-2'}`}>
               <Turnstile 
                  ref={turnstileRef}
                  siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""}
                  onSuccess={(token) => setTurnstileToken(token)}
                  options={{ size: 'flexible', theme: 'auto' }}
               />
          </div>

          <div className="min-h-[3rem] w-full flex items-center justify-center px-1 py-1">
              <div 
                  className={`
                      w-full p-2 flex items-center gap-2 text-[9px] font-bold
                      border-2 
                      transition-colors duration-200
                      ${error 
                          ? "bg-(--db-danger) border-(--db-border) text-white shadow-[2px_2px_0px_0px_var(--db-border)] animate-error-shake" 
                          : "bg-transparent border-transparent text-transparent select-none"
                      }
                  `}
              >
                  <AlertCircle className={`h-4 w-4 shrink-0 ${!error && "opacity-0"}`} />
                  <span className="leading-tight break-words w-full">
                     {error || "Placeholder"}
                  </span>
              </div>
          </div>

          <button 
              type="submit" 
              disabled={loading || !isTurnstileDone || !agreed} 
              className="w-full mt-0 bg-(--db-text) text-(--db-bg) border-2 border-(--db-border) py-3 font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_var(--db-border)] hover:-translate-y-1 hover:shadow-[8px_8px_0px_0px_var(--db-border)] hover:scale-[1.02] active:scale-[0.98] active:translate-y-0 transition-all disabled:opacity-50 text-sm disabled:cursor-not-allowed"
          >
              {loading ? <Loader2 className="animate-spin mx-auto w-5 h-5"/> : "CREATE ACCOUNT"}
          </button>
        </form>
      </div>
    </div>
  );
}
