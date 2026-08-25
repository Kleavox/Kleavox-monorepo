import { applicationForSubdomain, localViteOrigin } from "@kleavox/topology";

export { INTERNAL_HOSTS, INTERNAL_URLS } from "@kleavox/topology";

export const SESSION_COOKIE = "__Secure-kleavox_session";
export const VERIFICATION_COOKIE = "__Secure-kleavox_verified";

export function getPublicOrigin(
  rootOrigin: string,
  subdomain?: string,
): string {
  const url = new URL(rootOrigin);
  if (!subdomain) return url.origin;

  if (url.hostname === "localhost") {
    const application = applicationForSubdomain(subdomain);
    return application ? localViteOrigin(application) : url.origin;
  }

  return `https://${subdomain}.${url.host}`;
}
