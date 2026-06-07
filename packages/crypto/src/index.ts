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

  // @ts-ignore
  modulePromise = import("../pkg/kleavox_crypto.js").then(
    async (module) => {
      try {
        await module.default(wasm);
      } catch (error) {
        if (typeof process !== "undefined" && process.versions && process.versions.node) {
          try {
            const fs = await import("node:fs/promises");
            const path = await import("node:path");
            // @ts-ignore
            const dir = typeof import.meta.dirname !== "undefined" ? import.meta.dirname : __dirname;
            const wasmPath = path.join(dir, "..", "pkg", "kleavox_crypto_bg.wasm");
            const wasmBuffer = await fs.readFile(wasmPath);
            await module.default(wasmBuffer);
            return module as unknown as CryptoModule;
          } catch (fallbackError) {
             throw fallbackError;
          }
        }
        throw error;
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
