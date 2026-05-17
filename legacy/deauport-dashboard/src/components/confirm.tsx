"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type Options = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
};

type ConfirmFn = (opts: Options) => Promise<boolean>;

const ConfirmCtx = createContext<ConfirmFn>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<Options>({});
  const resolverRef = useRef<((val: boolean) => void) | null>(null);

  function confirm(newOpts: Options) {
    setOpts(newOpts);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }

  function resolve(val: boolean) {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(val);
      resolverRef.current = null;
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolve(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
            onClick={() => resolve(false)}
          />
          <div className="relative w-[92vw] max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow">
            <h3 className="text-base font-semibold">
              {opts.title ?? "Are you sure?"}
            </h3>
            <p className="mt-2 text-sm text-subtle">
              {opts.message ?? "This action cannot be undone."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="btn" onClick={() => resolve(false)}>
                {opts.cancelText ?? "Cancel"}
              </button>
              <button
                className={`btn ${opts.tone === "danger" ? "btn-danger" : "btn-primary"}`}
                onClick={() => resolve(true)}
              >
                {opts.confirmText ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmCtx);
}