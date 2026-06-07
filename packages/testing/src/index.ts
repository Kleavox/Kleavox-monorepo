import { vi } from "vitest";

export interface MockFetcher {
  fetch: ReturnType<typeof vi.fn>;
}

export function createMockFetcher() {
  return {
    fetch: vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
  };
}

export function createMockD1Database() {
  return {
    prepare: vi.fn().mockReturnThis(),
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  };
}

export function createMockKVNamespace() {
  return {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  };
}

export function createMockR2Bucket() {
  return {
    get: vi.fn(),
    head: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  };
}
