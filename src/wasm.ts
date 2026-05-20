// src/wasm.ts

// @ts-ignore
import './wasm_exec.js';
// @ts-ignore
import wasmBinary from './main.wasm';

declare global {
  function goSignJWT(payload: string, secret: string): { token?: string; error?: string };
  function goVerifyJWT(token: string, secret: string): { payload?: string; error?: string };
  function goHashPassword(password: string): { hash?: string; error?: string };
  function goVerifyPassword(hash: string, password: string): { ok: boolean };
  function goGenerateOTP(): { code?: string; error?: string };
  function goGenerateID(): { id?: string; error?: string };
}

let initialized = false;

export async function initWasm(): Promise<void> {
  if (initialized) return;
  // @ts-ignore
  const go = new Go();
  const instance = new WebAssembly.Instance(wasmBinary as WebAssembly.Module, go.importObject);
  go.run(instance);
  initialized = true;
}

export function signJWT(payload: string, secret: string): string {
  const result = goSignJWT(payload, secret);
  if (result.error) throw new Error(result.error);
  return result.token!;
}

export function verifyJWT(token: string, secret: string): string {
  const result = goVerifyJWT(token, secret);
  if (result.error) throw new Error(result.error);
  return result.payload!;
}

export async function hashPassword(password: string): Promise<string> {
  const result = goHashPassword(password);
  if (result.error) throw new Error(result.error);
  return result.hash!;
}

export function verifyPassword(hash: string, password: string): boolean {
  return goVerifyPassword(hash, password).ok;
}

export function generateOTP(): string {
  const result = goGenerateOTP();
  if (result.error) throw new Error(result.error);
  return result.code!;
}

export function generateID(): string {
  const result = goGenerateID();
  if (result.error) throw new Error(result.error);
  return result.id!;
}
