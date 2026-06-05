import { describe, expect, it } from "vitest";

import { hostRedirect } from "./hosts";

describe("gateway host redirects", () => {
  it("normalizes www while preserving path and query", () => {
    expect(
      hostRedirect(new URL("https://www.zarkiv.com/about?from=www"))?.toString(),
    ).toBe("https://zarkiv.com/about?from=www");
  });

  it("moves legacy product hosts to their canonical products", () => {
    expect(
      hostRedirect(new URL("https://bit.deau.site/settings"))?.toString(),
    ).toBe("https://link.zarkiv.com/settings");
    expect(
      hostRedirect(new URL("https://board.deau.site/"))?.toString(),
    ).toBe("https://pulse.zarkiv.com/");
  });

  it("keeps deau.site slugs available for Link resolution", () => {
    expect(hostRedirect(new URL("https://deau.site/legacy-slug"))).toBeNull();
    expect(hostRedirect(new URL("https://deau.site/"))?.toString()).toBe(
      "https://zarkiv.com/",
    );
  });
});
