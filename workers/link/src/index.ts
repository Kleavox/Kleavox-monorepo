import { withInitCrypto } from "@kleavox/crypto";
import cryptoWasm from "@kleavox/crypto/pkg/kleavox_crypto_bg.wasm";
import { app } from "./app";
import { runDropMaintenance } from "./drop/maintenance";
import type { Env } from "./env";

export default {
  fetch: withInitCrypto(cryptoWasm, app),
  scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): void {
    ctx.waitUntil(runDropMaintenance(env));
  },
};
