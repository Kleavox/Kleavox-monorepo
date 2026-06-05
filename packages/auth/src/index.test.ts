import { describe, expect, it } from "vitest";
import { readCookie } from "./index";

describe("readCookie", () => {
  it("reads an encoded cookie value", () => {
    const request = new Request("https://link.zarkiv.com", {
      headers: { cookie: "theme=dark; session=a%2Fb%3D" },
    });

    expect(readCookie(request, "session")).toBe("a/b=");
  });

  it("does not partially match cookie names", () => {
    const request = new Request("https://link.zarkiv.com", {
      headers: { cookie: "other_session=value" },
    });

    expect(readCookie(request, "session")).toBeNull();
  });
});
