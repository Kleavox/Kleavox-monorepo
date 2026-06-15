// @ts-ignore - Generated at build time
import { WASM_BASE64 } from "./wasm-base64";

export * from "./tokens";

interface StreamCipherClass {
  new (key: Uint8Array): StreamCipher;
}

export interface StreamCipher {
  push(chunk: Uint8Array, isLast: boolean): Uint8Array<ArrayBuffer>;
  free(): void;
}

interface CryptoModule {
  default: (wasm?: WebAssembly.Module | BufferSource) => Promise<unknown>;
  hash_password: (password: string, salt: string) => string;
  verify_password: (password: string, hash: string) => boolean;
  encrypt_data: (data: Uint8Array, password: string) => Uint8Array;
  decrypt_data: (data: Uint8Array, password: string) => Uint8Array;
  StreamEncryptor: StreamCipherClass;
  StreamDecryptor: StreamCipherClass;
}

export const STREAM_CHUNK_OVERHEAD = 16;

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

export async function initCrypto(
  wasm?: WebAssembly.Module | BufferSource,
): Promise<void> {
  if (modulePromise) {
    await modulePromise;
    return;
  }

  // @ts-ignore
  modulePromise = import("../pkg/kleavox_crypto.js").then(async (module) => {
    const input = wasm ?? decodeBase64ToUint8Array(WASM_BASE64);
    await module.default({ module_or_path: input });
    return module as unknown as CryptoModule;
  });
  try {
    await modulePromise;
  } catch (error) {
    modulePromise = undefined;
    throw error;
  }
}

async function loadCrypto(): Promise<CryptoModule> {
  if (!modulePromise) {
    await initCrypto();
  }
  return modulePromise!;
}

export function withInitCrypto<F extends (...args: never[]) => unknown>(
  wasm: WebAssembly.Module | BufferSource,
  app: { fetch: F },
): F {
  const handler = async (...args: Parameters<F>) => {
    await initCrypto(wasm);
    return app.fetch(...args);
  };
  return handler as unknown as F;
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const crypto = await loadCrypto();
  return crypto.hash_password(password, salt);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const crypto = await loadCrypto();
  return crypto.verify_password(password, hash);
}

export async function createStreamEncryptor(
  key: Uint8Array,
): Promise<StreamCipher> {
  const crypto = await loadCrypto();
  return new crypto.StreamEncryptor(key);
}

export async function createStreamDecryptor(
  key: Uint8Array,
): Promise<StreamCipher> {
  const crypto = await loadCrypto();
  return new crypto.StreamDecryptor(key);
}
