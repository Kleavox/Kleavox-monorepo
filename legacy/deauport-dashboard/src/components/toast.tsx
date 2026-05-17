"use client";
import { createContext, useContext, useState } from "react";

type T = { id: number; msg: string; kind?: "success" | "error" };
const Ctx = createContext<(msg: string, kind?: T["kind"]) => void>(() => {});

export function Toaster({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  function push(msg: string, kind: T["kind"] = "success") {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 2800);
  }
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast-container">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind === "error" ? "toast--error" : "toast--success"}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}