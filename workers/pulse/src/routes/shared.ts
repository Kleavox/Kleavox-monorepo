import type { SessionIdentity } from "@kleavox/core";
import type { Context, Hono } from "hono";

import type { Env } from "../env";
import type { CheckKind } from "../lib/checks";

export type PulseEnv = {
  Bindings: Env;
  Variables: { session: SessionIdentity };
};

export type PulseApp = Hono<PulseEnv>;
export type PulseContext = Context<PulseEnv>;

export interface CheckRow {
  id: string;
  node_id: string | null;
  name: string;
  kind: CheckKind;
  target: string;
  enabled: number;
  status: string;
  timeout_seconds: number;
  latency_ms: number | null;
  last_checked_at: string | null;
  consecutive_failures: number;
  last_message: string | null;
}

export async function readJson(context: PulseContext): Promise<unknown> {
  return context.req.json().catch(() => null);
}

export function invalidRequest(context: PulseContext) {
  return context.json(
    { code: "INVALID_REQUEST", message: "Check the submitted fields." },
    400,
  );
}
