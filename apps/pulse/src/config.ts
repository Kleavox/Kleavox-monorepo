export const ROOT_ORIGIN =
  import.meta.env.VITE_ROOT_ORIGIN ?? "https://example.com";
export const PASS_ORIGIN =
  import.meta.env.VITE_PASS_ORIGIN ?? "https://pass.example.com";

export function signInUrl(returnTo = window.location.href): string {
  const url = new URL(PASS_ORIGIN);
  url.searchParams.set("returnTo", returnTo);
  return url.toString();
}
