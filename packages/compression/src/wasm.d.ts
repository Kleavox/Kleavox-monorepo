declare module "../pkg/kleavox_compression.js" {
  export default function init(wasm?: WebAssembly.Module | BufferSource): Promise<any>;
  export function gzip_compress(input: Uint8Array): Uint8Array;
  export function max_input_bytes(): number;
  export function should_compress(fileName: string, contentType: string, sizeBytes: number): boolean;
}
