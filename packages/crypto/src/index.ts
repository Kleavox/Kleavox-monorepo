declare module "../pkg/kleavox_crypto.js" {
  export default function init(wasm?: WebAssembly.Module | BufferSource): Promise<any>;
  export function hash_password(password: string, salt: string): string;
  export function verify_password(password: string, hash: string): boolean;
  export function encrypt_data(data: Uint8Array, password: string): Uint8Array;
  export function decrypt_data(data: Uint8Array, password: string): Uint8Array;
}

interface CryptoModule {
  default: (wasm?: WebAssembly.Module | BufferSource) => Promise<unknown>;
  hash_password: (password: string, salt: string) => string;
  verify_password: (password: string, hash: string) => boolean;
  encrypt_data: (data: Uint8Array, password: string) => Uint8Array;
  decrypt_data: (data: Uint8Array, password: string) => Uint8Array;
}

let modulePromise: Promise<CryptoModule> | undefined;

export async function initCrypto(wasm?: WebAssembly.Module | BufferSource): Promise<void> {
  if (modulePromise) return;
  modulePromise = import("../pkg/kleavox_crypto.js").then(
    async (module) => {
      await module.default(wasm);
      return module;
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
