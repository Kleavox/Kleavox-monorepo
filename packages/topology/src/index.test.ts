import { describe, expect, it } from "vitest";

import {
  INTERNAL_HOSTS,
  INTERNAL_URLS,
  LOCAL_VITE_PORTS,
  LOCAL_WORKER_PORTS,
  applicationForSubdomain,
  localWorkerOrigin,
  publicHost,
  workerName,
} from "./index";

describe("Kleavox topology", () => {
  it("assigns every local process a unique port", () => {
    const ports = [
      ...Object.values(LOCAL_WORKER_PORTS),
      ...Object.values(LOCAL_VITE_PORTS),
    ];
    expect(new Set(ports).size).toBe(ports.length);
  });

  it("derives public and local locations", () => {
    expect(publicHost("kleavox.xyz", "gateway")).toBe("kleavox.xyz");
    expect(publicHost("kleavox.xyz", "link")).toBe("link.kleavox.xyz");
    expect(localWorkerOrigin("pass")).toBe("http://127.0.0.1:8787");
    expect(applicationForSubdomain("port")).toBe("portfolio");
    expect(workerName("kleavox", "pulse")).toBe("kleavox-pulse");
  });

  it("keeps internal URLs attached to their declared host", () => {
    expect(new URL(INTERNAL_URLS.SESSION_VERIFY).host).toBe(
      INTERNAL_HOSTS.PASS,
    );
    expect(new URL(INTERNAL_URLS.LINK_PURGE).host).toBe(INTERNAL_HOSTS.LINK);
    expect(new URL(INTERNAL_URLS.PULSE_REPORT_NOTIFY).host).toBe(
      INTERNAL_HOSTS.PULSE,
    );
  });
});
