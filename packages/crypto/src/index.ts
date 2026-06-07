// @ts-ignore - Generated at build time
import { WASM_BASE64 } from "./wasm-base64";

interface CryptoModule {
  default: (wasm?: WebAssembly.Module | BufferSource) => Promise<unknown>;
  hash_password: (password: string, salt: string) => string;
  verify_password: (password: string, hash: string) => boolean;
  encrypt_data: (data: Uint8Array, password: string) => Uint8Array;
  decrypt_data: (data: Uint8Array, password: string) => Uint8Array;
}

let modulePromise: Promise<CryptoModule> | undefined;

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function initCrypto(): Promise<void> {
  if (modulePromise) return;

  // @ts-ignore
  modulePromise = import("../pkg/kleavox_crypto.js").then(
    async (module) => {
      try {
        const wasmBuffer = decodeBase64ToUint8Array(WASM_BASE64);
        await module.default(wasmBuffer);
      } catch (error) {
        console.warn("WASM initialization warning:", error);
      }
      return module as unknown as CryptoModule;
    },
  );
  await modulePromise;
}

async function loadCrypto(): Promise<CryptoModule> {
  if (!modulePromise) {
    await initCrypto();
  }
  return modulePromise!;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const crypto = await loadCrypto();
  return crypto.hash_password(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const crypto = await loadCrypto();
  return crypto.verify_password(password, hash);
}

export async function encrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
  const crypto = await loadCrypto();
  return crypto.encrypt_data(data, password);
}

export async function decrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
  const crypto = await loadCrypto();
  return crypto.decrypt_data(data, password);
}
