import type { Identity } from "@kleavox/core";

export type Mode = "login" | "register" | "forgot";

export interface SessionResponse {
  authenticated: boolean;
  user?: Identity;
  expiresAt?: string;
}

export interface FormState {
  status: "idle" | "loading" | "error" | "success";
  message?: string;
}

export interface OAuthProviders {
  google: boolean;
  github: boolean;
}

export interface DeviceSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  ip: string | null;
  current: boolean;
}
