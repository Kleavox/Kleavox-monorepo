export const PUBLIC_LINK_DRAFT_KEY = "link:draft:public";
export const REPORT_DRAFT_KEY = "link:draft:report";

export function readDraft<T>(key: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function saveDraft(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function clearDraft(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
