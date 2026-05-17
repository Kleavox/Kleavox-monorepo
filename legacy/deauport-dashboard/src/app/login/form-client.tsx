"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

export default function LoginForm({ errorMsg = "" }: { errorMsg?: string }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pwdRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    pwdRef.current?.focus();
  }, []);

  function onKeydown(e: React.KeyboardEvent<HTMLInputElement>) {
  const capsOn = e.getModifierState?.("CapsLock");
  if (typeof capsOn === "boolean") setCaps(capsOn);
  }

  return (
    <form
      method="post"
      action="/api/auth/login"
      className="space-y-4"
      onSubmit={() => setSubmitting(true)}
    >
      {errorMsg ? (
        <div className="rounded-lg border border-rose-700/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {errorMsg}
        </div>
      ) : null}

      <label className="text-xs text-subtle block">Password</label>

      <div className="input flex items-center gap-2">
        <span className="shrink-0 text-subtle">
          <Lock size={16} />
        </span>

        <input
          ref={pwdRef}
          name="password"
          type={show ? "text" : "password"}
          required
          className="flex-1 bg-transparent outline-none border-0 px-0 py-0"
          placeholder="••••••••"
          onKeyDown={onKeydown}
          autoComplete="current-password"
        />

        <button
          type="button"
          className="shrink-0 rounded-md p-1.5 text-subtle hover:bg-[var(--surface-3)] focus:outline-none"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          title={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {caps ? (
        <div className="text-[11px] text-amber-300">Caps Lock aktif</div>
      ) : null}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="remember" className="checkbox" />
        Remember me (30 hari)
      </label>

      <button className="btn btn-primary w-full" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Login"}
      </button>

      <p className="pt-1 text-center text-[11px] text-subtle">
        Password diverifikasi aman di server (ENV · SHA-256).
      </p>
    </form>
  );
}