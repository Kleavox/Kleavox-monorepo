import { apiFetch, type Identity } from "@kleavox/core";

export interface VerifiedOtp {
  authenticated: true;
  user: Identity;
  needsSetup: boolean;
}

export async function startOtp(email: string): Promise<void> {
  await apiFetch<{ ok: true }>("/api/auth/otp/start", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtpCode(
  email: string,
  code: string,
): Promise<VerifiedOtp> {
  return apiFetch<VerifiedOtp>("/api/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}
