import { describe, expect, it } from "vitest";

import { clientContext, parseExpiration, parseTargetUrl } from "./request";

describe("Link request helpers", () => {
  it("accepts only HTTP destinations and removes credentials", () => {
    expect(parseTargetUrl("https://user:secret@example.com/path")).toBe(
      "https://example.com/path",
    );
    expect(parseTargetUrl("javascript:alert(1)")).toBeNull();
  });

  it("requires future expiration values", () => {
    expect(parseExpiration("2000-01-01T00:00:00.000Z")).toBeNull();
    expect(
      parseExpiration(new Date(Date.now() + 60_000).toISOString()),
    ).not.toBeNull();
  });

  it("extracts coarse analytics without an IP address", () => {
    const request = new Request("https://zarkiv.com/example", {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/125 Safari/537.36",
        referer: "https://example.org/article",
      },
    });
    expect(clientContext(request)).toMatchObject({
      browser: "Chrome",
      operatingSystem: "Windows",
      deviceType: "desktop",
      referrerHost: "example.org",
    });
  });
});
