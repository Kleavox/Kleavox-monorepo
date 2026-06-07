import { initCrypto } from "@kleavox/crypto";
import { app } from "./app";

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext) {
    await initCrypto();
    return app.fetch(request, env, ctx);
  }
};
