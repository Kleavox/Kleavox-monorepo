"use client";
import { useEffect, useState } from "react";

const STORAGE_KEY = "deauport_api_key";
const PREFILL = process.env.NEXT_PUBLIC_DASH_API_KEY || "";

export function ApiKeyBox() {
  const [value, setValue] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setValue(saved);
    else if (PREFILL) {
      setValue(PREFILL);
      localStorage.setItem(STORAGE_KEY, PREFILL);
    }
  }, []);

  function save() {
    localStorage.setItem(STORAGE_KEY, value.trim());
  }
  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    setValue("");
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="x-api-key"
        className="w-64 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm"
      />
      <button onClick={save} className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Save</button>
      <button onClick={clear} className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Clear</button>
    </div>
  );
}

export function getApiKeyFromBrowser() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) ?? "";
}