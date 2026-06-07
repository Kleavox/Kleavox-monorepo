import { initCrypto } from "@kleavox/crypto";
// @ts-expect-error WASM import
import wasm from "@kleavox/crypto/wasm";
import { app } from "./app";

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    await initCrypto(wasm);
    return app.fetch(request, env, ctx);
  }
};
