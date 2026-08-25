import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPATIBILITY_DATE } from "@kleavox/topology";
import { describe, expect, it } from "vitest";

import { productionConfigs, productionSecrets } from "./config";

const env = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  APP_ROOT_DOMAIN: "product.test",
  WORKER_PREFIX: "product",
  PASS_D1_ID: "11111111-1111-1111-1111-111111111111",
  PASS_KV_ID: "11111111111111111111111111111111",
  LINK_D1_ID: "22222222-2222-2222-2222-222222222222",
  PULSE_D1_ID: "33333333-3333-3333-3333-333333333333",
  DROP_BUCKET_NAME: "product-files",
  AUTH_FROM_EMAIL: "Product <no-reply@product.test>",
};

describe("production deployment config", () => {
  it("keeps static Wrangler configs on the shared compatibility date", () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    for (const worker of ["pass", "link", "pulse", "gateway"]) {
      const source = readFileSync(
        path.join(root, "workers", worker, "wrangler.jsonc"),
        "utf8",
      );
      expect(source).toContain(`"compatibility_date": "${COMPATIBILITY_DATE}"`);
    }
  });

  it("renders route-free staging configs", () => {
    const configs = productionConfigs(env, "none");
    expect(configs["pass"]?.routes).toBeUndefined();
    expect(configs["gateway"]?.routes).toBeUndefined();
    expect(configs["pass"]?.vars).toMatchObject({ ENVIRONMENT: "production" });
  });

  it("derives canonical domains and resource names from environment", () => {
    const configs = productionConfigs(env, "canonical");
    expect(configs["gateway"]?.routes).toEqual([
      { pattern: "product.test", custom_domain: true },
      { pattern: "www.product.test", custom_domain: true },
    ]);
    expect(configs["link"]?.routes).toEqual([
      { pattern: "link.product.test", custom_domain: true },
    ]);
    expect(configs["portfolio"]).toBeUndefined();
    expect(configs["drop"]).toBeUndefined();
    expect(configs["link"]?.r2_buckets).toEqual([
      { binding: "FILES", bucket_name: "product-files" },
    ]);
    expect(configs["link"]?.triggers).toEqual({ crons: ["*/15 * * * *"] });
    expect(configs["gateway"]?.services).toEqual([
      { binding: "LINK", service: "product-link" },
      { binding: "PASS", service: "product-pass" },
      { binding: "PULSE", service: "product-pulse" },
      { binding: "PORTFOLIO", service: "product-portfolio" },
    ]);
  });

  it("refuses placeholder resource ids", () => {
    expect(() =>
      productionConfigs(
        {
          ...env,
          LINK_D1_ID: "00000000-0000-0000-0000-000000000000",
        },
        "none",
      ),
    ).toThrow(/LINK_D1_ID/u);
  });

  it("ignores unrelated runner environment variables", () => {
    const runnerEnvironment = { ...env, DOTNET_MULTILEVEL_LOOKUP: "0" };
    expect(() => productionConfigs(runnerEnvironment, "none")).not.toThrow();
  });
});

describe("production secrets", () => {
  it("uses generic repository secret names as Worker bindings", () => {
    const result = productionSecrets({
      RESEND_API_KEY: "resend",
      TURNSTILE_SECRET_KEY: "turnstile",
      IP_HASH_SECRET: "audit",
      GOOGLE_CLIENT_ID: "google-id",
      GOOGLE_CLIENT_SECRET: "google-secret",
      GITHUB_CLIENT_ID: "github-id",
      GITHUB_CLIENT_SECRET: "github-secret",
      GUEST_HASH_SECRET: "guest",
      DOWNLOAD_SIGNING_SECRET: "download",
      PASSWORD_HASH_SECRET: "password",
    });
    expect(result.pass.RESEND_API_KEY).toBe("resend");
    expect(result.link.PASSWORD_HASH_SECRET).toBe("password");
    expect(result).not.toHaveProperty("portfolio");
  });
});
