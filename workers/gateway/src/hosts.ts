const LEGACY_REDIRECTS: Record<string, string> = {
  "port.deau.site": "https://port.zarkiv.com/",
  "bit.deau.site": "https://link.zarkiv.com",
  "one.deau.site": "https://pass.zarkiv.com",
  "board.deau.site": "https://pulse.zarkiv.com",
};

export function hostRedirect(url: URL): URL | null {
  if (url.hostname === "www.zarkiv.com") {
    return withPath("https://zarkiv.com", url);
  }

  const destination = LEGACY_REDIRECTS[url.hostname];
  if (destination) {
    return withPath(destination, url);
  }

  if (url.hostname === "deau.site" && url.pathname === "/") {
    return new URL("https://zarkiv.com/");
  }

  return null;
}

function withPath(origin: string, source: URL): URL {
  const destination = new URL(origin);
  destination.pathname = source.pathname;
  destination.search = source.search;
  destination.hash = source.hash;
  return destination;
}
