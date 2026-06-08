export const ROOT_ORIGIN =
  import.meta.env.VITE_ROOT_ORIGIN ?? "https://example.com";
export const LINK_ORIGIN =
  import.meta.env.VITE_LINK_ORIGIN ?? "https://link.example.com";
export const PASS_ORIGIN =
  import.meta.env.VITE_PASS_ORIGIN ?? "https://pass.example.com";
export const ROOT_HOST = new URL(ROOT_ORIGIN).host;

export function signInUrl(returnTo = window.location.href): string {
  const url = new URL(PASS_ORIGIN);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

export function challengeUrl(
  scope: "basic" | "fresh",
  returnTo = window.location.href,
): string {
  const url = new URL("/challenge", PASS_ORIGIN);
  url.searchParams.set("scope", scope);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
