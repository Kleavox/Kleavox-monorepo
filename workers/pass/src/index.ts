import { withInitCrypto } from "@kleavox/crypto";
import cryptoWasm from "@kleavox/crypto/pkg/kleavox_crypto_bg.wasm";
import app from "./app";

export default {
  fetch: withInitCrypto(cryptoWasm, app),
};
