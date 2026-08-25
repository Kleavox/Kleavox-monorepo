import type {
  DropPolicy,
  DropSessionResponse,
  UploadStartResponse,
} from "@kleavox/link-protocol";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prepareUpload: vi.fn(),
  uploadPart: vi.fn(),
  createStreamEncryptor: vi.fn(),
  decodeBase64Url: vi.fn(),
  sealToPublicKey: vi.fn(),
}));

vi.mock("@kleavox/compression", () => ({
  prepareUpload: mocks.prepareUpload,
}));

vi.mock("@kleavox/crypto", () => ({
  STREAM_CHUNK_OVERHEAD: 16,
  createStreamEncryptor: mocks.createStreamEncryptor,
  decodeBase64Url: mocks.decodeBase64Url,
  sealToPublicKey: mocks.sealToPublicKey,
}));

vi.mock("../files-format", () => ({
  uploadPart: mocks.uploadPart,
}));

vi.mock("../e2e", () => ({
  dropKeyStorageKey: (token: string) => `drop:${token}`,
  encryptedShareUrl: (url: string, key: string) => `${url}#${key}`,
  generateDropKey: () => "local-drop-key",
}));

import { sendTransfer, type TransferPhase } from "./send";

const policy: DropPolicy = {
  kind: "guest",
  maxFileBytes: 1_000_000,
  maxActiveBytes: 1_000_000,
  retentionOptions: [3600],
  maxDownloads: 5,
  defaultDownloads: 3,
  partSizeBytes: 32,
};

const anonymousSession: DropSessionResponse = {
  authenticated: false,
  policy,
};

const accountSession: DropSessionResponse = {
  authenticated: true,
  user: {
    id: "user-1",
    email: "sender@example.com",
    username: "sender",
    role: "USER",
  },
  policy: { ...policy, kind: "user" },
};

describe("sendTransfer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() {
        return storage.size;
      },
    });
    mocks.uploadPart.mockImplementation(
      async (
        _uploadId: string,
        _partNumber: number,
        part: Blob,
        _manageToken: string,
        onProgress: (loaded: number) => void,
      ) => onProgress(part.size),
    );
  });

  it("compresses a guest transfer and completes every lifecycle phase", async () => {
    const file = new File(["abcdefghij"], "notes.txt", {
      type: "text/plain",
    });
    mocks.prepareUpload.mockResolvedValue({
      body: new Blob(["zip!"], { type: "text/plain" }),
      originalSizeBytes: 10,
      storedSizeBytes: 4,
      storageEncoding: "gzip",
      savedBytes: 6,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(uploadStart({ partCount: 2, partSizeBytes: 2 })),
        )
        .mockResolvedValueOnce(jsonResponse(completedUpload())),
    );
    const phases: TransferPhase[] = [];
    const progress: number[] = [];

    const result = await sendTransfer({
      file,
      session: anonymousSession,
      retentionSeconds: 3600,
      maxDownloads: 3,
      recipients: "",
      onPhase: (phase) => phases.push(phase),
      onProgress: (value) => progress.push(value),
    });

    expect(phases).toEqual([
      "optimizing",
      "preparing",
      "uploading",
      "finishing",
    ]);
    expect(mocks.uploadPart).toHaveBeenCalledTimes(2);
    expect(progress.at(-1)).toBe(100);
    expect(result).toMatchObject({ savedBytes: 6, encrypted: false });
  });

  it("keeps an account transfer key only in the share fragment and local cache", async () => {
    const file = new File(["account data"], "account.txt");
    const free = vi.fn();
    mocks.decodeBase64Url.mockReturnValue(new Uint8Array(32));
    mocks.createStreamEncryptor.mockResolvedValue({
      push: () => new Uint8Array(28),
      free,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(uploadStart()))
        .mockResolvedValueOnce(jsonResponse(completedUpload())),
    );

    const result = await sendTransfer({
      file,
      session: accountSession,
      retentionSeconds: 3600,
      maxDownloads: 3,
      recipients: "",
    });

    expect(result.shareUrl).toBe(
      "https://kleavox.xyz/public-token#local-drop-key",
    );
    expect(localStorage.getItem("drop:public-token")).toBe("local-drop-key");
    expect(result.encrypted).toBe(true);
    expect(free).toHaveBeenCalledOnce();
  });

  it("normalizes recipients and seals one key for each unique account", async () => {
    const file = new File(["shared account data"], "shared.txt");
    mocks.sealToPublicKey.mockResolvedValue("sealed-key");
    mocks.createStreamEncryptor.mockResolvedValue({
      push: () => new Uint8Array(35),
      free: vi.fn(),
    });
    let reservation: RequestInit | undefined;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("recipient-key")) {
          return jsonResponse({
            userId: "recipient-1",
            publicKey: "public-key",
          });
        }
        if (url === "/api/uploads") {
          reservation = init;
          return jsonResponse(uploadStart());
        }
        return jsonResponse(completedUpload());
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    await sendTransfer({
      file,
      session: accountSession,
      retentionSeconds: 3600,
      maxDownloads: 3,
      recipients: " @Alice, alice ",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/drop/recipient-key?username=alice",
    );
    const body = JSON.parse(String(reservation?.body)) as {
      recipients: unknown[];
    };
    expect(body.recipients).toEqual([
      { userId: "recipient-1", sealedKey: "sealed-key" },
    ]);
  });

  it("aborts a reserved upload without hiding the original part failure", async () => {
    const file = new File(["failure"], "failure.txt");
    mocks.prepareUpload.mockResolvedValue({
      body: file,
      originalSizeBytes: file.size,
      storedSizeBytes: file.size,
      savedBytes: 0,
    });
    mocks.uploadPart.mockRejectedValue(new Error("part failed"));
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(uploadStart()))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTransfer({
        file,
        session: anonymousSession,
        retentionSeconds: 3600,
        maxDownloads: 3,
        recipients: "",
      }),
    ).rejects.toThrow("part failed");
    expect(fetchMock).toHaveBeenLastCalledWith("/api/uploads/upload-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer manage-token" },
    });
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}

function uploadStart(
  override: Partial<UploadStartResponse> = {},
): UploadStartResponse {
  return {
    uploadId: "upload-1",
    manageToken: "manage-token",
    publicToken: "public-token",
    shareUrl: "https://kleavox.xyz/public-token",
    partSizeBytes: 64,
    partCount: 1,
    expiresAt: "2026-07-18T10:00:00.000Z",
    maxDownloads: 3,
    ...override,
  };
}

function completedUpload() {
  return {
    publicToken: "public-token",
    shareUrl: "https://kleavox.xyz/public-token",
    expiresAt: "2026-07-18T10:00:00.000Z",
  };
}
