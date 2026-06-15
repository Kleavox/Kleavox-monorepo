// @ts-ignore - Generated at build time
import { WASM_BASE64 } from "./wasm-base64";
import { decodeBase64Url, encodeBase64Url } from "./tokens";

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
  derive_key: (password: string, salt: Uint8Array) => Uint8Array<ArrayBuffer>;
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

const HKDF_MK_INFO = new TextEncoder().encode("kleavox/mk/v1");
const HKDF_AUTH_INFO = new TextEncoder().encode("kleavox/auth/v1");
const ACCOUNT_SALT_BYTES = 16;
const KEY_WRAP_IV_BYTES = 12;

export interface AccountCredential {
  salt: string;
  authVerifier: string;
  accountPublicKey: string;
  wrappedPrivateKey: string;
}

async function deriveStretched(
  password: string,
  salt: Uint8Array,
): Promise<Uint8Array<ArrayBuffer>> {
  const module = await loadCrypto();
  return module.derive_key(password, salt);
}

async function deriveMasterAndVerifier(
  password: string,
  salt: Uint8Array,
): Promise<{ masterKey: CryptoKey; authVerifier: string }> {
  const stretched = await deriveStretched(password, salt);
  const base = await crypto.subtle.importKey("raw", stretched, "HKDF", false, [
    "deriveBits",
  ]);
  const emptySalt = new Uint8Array(0);
  const [mkBits, verifierBits] = await Promise.all([
    crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: emptySalt, info: HKDF_MK_INFO },
      base,
      256,
    ),
    crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: emptySalt, info: HKDF_AUTH_INFO },
      base,
      256,
    ),
  ]);
  const masterKey = await crypto.subtle.importKey(
    "raw",
    mkBits,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return {
    masterKey,
    authVerifier: encodeBase64Url(new Uint8Array(verifierBits)),
  };
}

async function wrapPrivateKey(
  pkcs8: Uint8Array<ArrayBuffer>,
  masterKey: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(KEY_WRAP_IV_BYTES));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, masterKey, pkcs8),
  );
  const out = new Uint8Array(iv.length + ciphertext.length);
  out.set(iv, 0);
  out.set(ciphertext, iv.length);
  return encodeBase64Url(out);
}

async function unwrapPrivateKey(
  wrapped: string,
  masterKey: CryptoKey,
): Promise<CryptoKey> {
  const bytes = decodeBase64Url(wrapped);
  const iv = bytes.subarray(0, KEY_WRAP_IV_BYTES);
  const ciphertext = bytes.subarray(KEY_WRAP_IV_BYTES);
  const pkcs8 = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    masterKey,
    ciphertext,
  );
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveBits"],
  );
}

export async function createAccountCredential(
  password: string,
): Promise<AccountCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(ACCOUNT_SALT_BYTES));
  const { masterKey, authVerifier } = await deriveMasterAndVerifier(
    password,
    salt,
  );
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const publicRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey),
  );
  const pkcs8 = new Uint8Array(
    await crypto.subtle.exportKey("pkcs8", keyPair.privateKey),
  );
  return {
    salt: encodeBase64Url(salt),
    authVerifier,
    accountPublicKey: encodeBase64Url(publicRaw),
    wrappedPrivateKey: await wrapPrivateKey(pkcs8, masterKey),
  };
}

export async function deriveAuthVerifier(
  password: string,
  salt: string,
): Promise<string> {
  const { authVerifier } = await deriveMasterAndVerifier(
    password,
    decodeBase64Url(salt),
  );
  return authVerifier;
}

export async function unlockAccount(
  password: string,
  salt: string,
  wrappedPrivateKey: string,
): Promise<{
  authVerifier: string;
  masterKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  const { masterKey, authVerifier } = await deriveMasterAndVerifier(
    password,
    decodeBase64Url(salt),
  );
  const privateKey = await unwrapPrivateKey(wrappedPrivateKey, masterKey);
  return { authVerifier, masterKey, privateKey };
}
