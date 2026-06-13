import { initCrypto } from "@kleavox/crypto";
import cryptoWasm from "@kleavox/crypto/pkg/kleavox_crypto_bg.wasm";
import { app } from "./app";
import { runDropMaintenance } from "./drop/maintenance";
import type { Env } from "./env";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    await initCrypto(cryptoWasm);
    return app.fetch(request, env, ctx);
  },
  scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): void {
    ctx.waitUntil(runDropMaintenance(env));
  },
};
