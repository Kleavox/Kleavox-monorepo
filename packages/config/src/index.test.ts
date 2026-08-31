import { describe, expect, it } from "vitest";

import { getPublicOrigin } from "./index";

describe("public origins", () => {
  it("keeps the deployed shape on a real domain", () => {
    expect(getPublicOrigin("https://kleavox.xyz")).toBe("https://kleavox.xyz");
    expect(getPublicOrigin("https://kleavox.xyz", "link")).toBe(
      "https://link.kleavox.xyz",
    );
    expect(getPublicOrigin("https://kleavox.xyz", "port")).toBe(
      "https://port.kleavox.xyz",
    );
  });
});

describe("local origins", () => {
  it("answers with worker ports when the root is the gateway worker", () => {
    expect(getPublicOrigin("http://127.0.0.1:8786", "pass")).toBe(
      "http://127.0.0.1:8787",
    );
    expect(getPublicOrigin("http://127.0.0.1:8786", "link")).toBe(
      "http://127.0.0.1:8788",
    );
    expect(getPublicOrigin("http://127.0.0.1:8786", "pulse")).toBe(
      "http://127.0.0.1:8790",
    );
  });

  it("answers with vite ports when the root is the gateway vite server", () => {
    expect(getPublicOrigin("http://localhost:3000", "link")).toBe(
      "http://localhost:3002",
    );
    expect(getPublicOrigin("http://localhost:3000", "pulse")).toBe(
      "http://localhost:3003",
    );
  });

  it("treats every loopback host the same, and keeps the host it was given", () => {
    for (const host of ["localhost", "127.0.0.1", "127.0.0.2", "[::1]"]) {
      expect(getPublicOrigin(`http://${host}:8786`, "link")).toBe(
        `http://${host}:8788`,
      );
    }
  });

  it("never invents a subdomain of a loopback address", () => {
    for (const root of [
      "http://127.0.0.1:8786",
      "http://localhost:3000",
      "http://localhost:8786",
    ]) {
      for (const subdomain of ["pass", "link", "pulse", "port"]) {
        const resolved = new URL(getPublicOrigin(root, subdomain));
        expect(resolved.hostname).toBe(new URL(root).hostname);
        expect(resolved.protocol).toBe("http:");
      }
    }
  });

  it("sends portfolio to its vite server, the only local address it has", () => {
    expect(getPublicOrigin("http://127.0.0.1:8786", "port")).toBe(
      "http://127.0.0.1:3004",
    );
    expect(getPublicOrigin("http://localhost:3000", "port")).toBe(
      "http://localhost:3004",
    );
  });

  it("stays on the root origin when the port belongs to no known family", () => {
    expect(getPublicOrigin("http://127.0.0.1:4321", "link")).toBe(
      "http://127.0.0.1:4321",
    );
  });

  it("stays on the root origin for a subdomain it does not know", () => {
    expect(getPublicOrigin("http://127.0.0.1:8786", "drop")).toBe(
      "http://127.0.0.1:8786",
    );
  });
});
