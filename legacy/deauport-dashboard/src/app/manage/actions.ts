"use server";

const BASE = process.env.NEXT_PUBLIC_API_BASE!;
const RAW_KEY =
  (process.env.DASH_API_KEY ?? process.env.NEXT_PUBLIC_DASH_API_KEY) ?? "";

function getKey(): string {
  const k = RAW_KEY.trim();
  if (!k) {
    throw new Error(
      "Dashboard API key kosong. Setel DASH_API_KEY atau NEXT_PUBLIC_DASH_API_KEY di .env.local (dashboard) lalu restart."
    );
  }
  return k;
}

async function reqJSON(path: string, init: RequestInit) {
  const key = getKey();

  const hdr: Record<string, string> = {
    "x-api-key": key,
  };
  if (init.body != null) {
    hdr["Content-Type"] = "application/json";
  }
  if (init.headers) {
    Object.assign(hdr, init.headers as Record<string, string>);
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: hdr,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} – ${body}`);
  }

  if (res.status === 204) return null;

  const len = res.headers.get("content-length");
  if (len === "0" || len === null) {
    try { return await res.json(); } catch { return null; }
  }

  return res.json();
}

export async function createCheckAction(payload: {
  name: string;
  targetUrl: string;
  intervalSec: number;
}) {
  return reqJSON(`/api/uptime/checks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function toggleCheckAction(id: string, enabled: boolean) {
  return reqJSON(`/api/uptime/checks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteCheckAction(id: string) {
  return reqJSON(`/api/uptime/checks/${id}`, {
    method: "DELETE",
  });
}

export async function createShortlinkAction(payload: {
  slug: string;
  targetUrl: string;
}) {
  return reqJSON(`/api/shortlinks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function toggleShortlinkAction(id: string, enabled: boolean) {
  return reqJSON(`/api/shortlinks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteShortlinkAction(id: string) {
  return reqJSON(`/api/shortlinks/${id}`, {
    method: "DELETE",
  });
}

export async function triggerRecapAction() {
  return reqJSON(`/api/recap/trigger`, {
    method: "POST",
  });
}

export async function triggerManualBackupAction() {
  return reqJSON(`/api/recap/manual-backup`, {
    method: "POST",
  });
}

export async function importDataAction(formData: FormData) {
  const key = getKey();
  const file = formData.get("file");

  if (!file) {
    throw new Error("No file provided.");
  }

  const res = await fetch(`${BASE}/api/import`, {
    method: "POST",
    headers: { "x-api-key": key },
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} – ${body}`);
  }
  return res.json();
}