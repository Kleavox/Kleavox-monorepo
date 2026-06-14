import type { Identity } from "@kleavox/core";

import type { AccountDrop } from "./files";

export interface LinkRecord {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  protected: boolean;
  expiresAt: string | null;
  disabledAt: string | null;
  clickCount: number;
  lastClickedAt: string | null;
  createdAt: string;
}

export interface SessionResponse {
  authenticated: boolean;
  identity?: Identity;
}

export interface LinkStats {
  total: number;
  lastClickedAt: string | null;
  daily: Array<{ date: string; value: number }>;
  browsers: Array<{ name: string; value: number }>;
  countries: Array<{ name: string; value: number }>;
  referrers: Array<{ name: string; value: number }>;
}

export type LoadState =
  | { status: "loading" }
  | { status: "guest" }
  | {
      status: "ready";
      identity: Identity;
      links: LinkRecord[];
      files: AccountDrop[];
    }
  | { status: "error"; message: string };

export interface FormState {
  status: "idle" | "loading" | "error" | "success";
  message?: string;
}
