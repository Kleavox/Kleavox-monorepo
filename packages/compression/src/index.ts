interface CompressionModule {
  default: () => Promise<unknown>;
  gzip_compress: (input: Uint8Array) => Uint8Array;
  max_input_bytes: () => number;
  should_compress: (
    fileName: string,
    contentType: string,
    sizeBytes: number,
  ) => boolean;
}

export interface PreparedUpload {
  body: Blob;
  originalSizeBytes: number;
  storedSizeBytes: number;
  storageEncoding?: "gzip";
  savedBytes: number;
}

let modulePromise: Promise<CompressionModule> | undefined;

export async function prepareUpload(file: File): Promise<PreparedUpload> {
  try {
    const compression = await loadCompression();
    if (
      !compression.should_compress(file.name, file.type, file.size) ||
      file.size > compression.max_input_bytes()
    ) {
      return original(file);
    }

    const source = new Uint8Array(await file.arrayBuffer());
    const compressed = compression.gzip_compress(source);
    if (compressed.byteLength >= Math.floor(file.size * 0.9)) {
      return original(file);
    }

    const stored = Uint8Array.from(compressed);
    return {
      body: new Blob([stored.buffer], { type: "application/gzip" }),
      originalSizeBytes: file.size,
      storedSizeBytes: stored.byteLength,
      storageEncoding: "gzip",
      savedBytes: file.size - stored.byteLength,
    };
  } catch {
    return original(file);
  }
}

function original(file: File): PreparedUpload {
  return {
    body: file,
    originalSizeBytes: file.size,
    storedSizeBytes: file.size,
    savedBytes: 0,
  };
}

async function loadCompression(): Promise<CompressionModule> {
  if (!modulePromise) {
    modulePromise = import("../pkg/kleavox_compression.js").then(
      async (module) => {
        await module.default();
        return module;
      },
    );
  }
  return modulePromise;
}
