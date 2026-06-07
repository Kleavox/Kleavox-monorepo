declare module "../pkg/kleavox_crypto.js" {
  export default function init(wasm?: WebAssembly.Module | BufferSource): Promise<any>;
  export function hash_password(password: string, salt: string): string;
  export function verify_password(password: string, hash: string): boolean;
  export function encrypt_data(data: Uint8Array, password: string): Uint8Array;
  export function decrypt_data(data: Uint8Array, password: string): Uint8Array;
}
