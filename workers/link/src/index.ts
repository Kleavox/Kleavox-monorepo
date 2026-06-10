import { initCrypto } from "@kleavox/crypto";
import cryptoWasm from "@kleavox/crypto/pkg/kleavox_crypto_bg.wasm";
import { app } from "./app";

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    await initCrypto(cryptoWasm);
    return app.fetch(request, env, ctx);
  }
};
