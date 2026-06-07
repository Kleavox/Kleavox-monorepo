interface CompressionModule {
  default: (wasm?: WebAssembly.Module | BufferSource) => Promise<unknown>;
  gzip_compress: (input: Uint8Array) => Uint8Array;
  max_input_bytes: () => number;
  should_compress: (
    fileName: string,
    contentType: string,
    sizeBytes: number,
  ) => boolean;
}

let modulePromise: Promise<CompressionModule> | undefined;

async function loadCompression(): Promise<CompressionModule> {
  if (!modulePromise) {
    // @ts-ignore
    modulePromise = import("../pkg/kleavox_compression.js").then(
      async (module) => {
        await module.default();
        return module as unknown as CompressionModule;
      },
    );
  }
  return modulePromise!;
}

export interface PreparedUpload {
  body: Blob;
  originalSizeBytes: number;
  storedSizeBytes: number;
  storageEncoding?: "gzip" | "aes-256-gcm";
  savedBytes: number;
}

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  const { gzip_compress, max_input_bytes, should_compress } =
    await loadCompression();

  if (file.size > max_input_bytes() || !should_compress(file.name, file.type, file.size)) {
    return {
      body: file,
      originalSizeBytes: file.size,
      storedSizeBytes: file.size,
      savedBytes: 0,
    };
  }

  const source = new Uint8Array(await file.arrayBuffer());
  const compressed = gzip_compress(source);

  if (compressed.length >= source.length) {
    return {
      body: file,
      originalSizeBytes: file.size,
      storedSizeBytes: file.size,
      savedBytes: 0,
    };
  }

  return {
    body: new Blob([compressed as any], { type: file.type }),
    originalSizeBytes: file.size,
    storedSizeBytes: compressed.length,
    storageEncoding: "gzip",
    savedBytes: file.size - compressed.length,
  };
}
