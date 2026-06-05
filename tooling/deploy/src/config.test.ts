import { describe, expect, it } from "vitest";

import { productionConfigs, productionSecrets } from "./config";

const env = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  ZARKIV_PASS_D1_ID: "11111111-1111-1111-1111-111111111111",
  ZARKIV_PASS_KV_ID: "11111111111111111111111111111111",
  ZARKIV_LINK_D1_ID: "22222222-2222-2222-2222-222222222222",
  ZARKIV_PULSE_D1_ID: "33333333-3333-3333-3333-333333333333",
  ZARKIV_DROP_D1_ID: "44444444-4444-4444-4444-444444444444",
};

describe("production deployment config", () => {
  it("renders route-free staging configs", () => {
    const configs = productionConfigs(env, "none");
    expect(configs["pass"]?.routes).toBeUndefined();
    expect(configs["gateway"]?.routes).toBeUndefined();
    expect(configs["pass"]?.vars).toMatchObject({ ENVIRONMENT: "production" });
  });

  it("attaches canonical and legacy domains only when requested", () => {
    const canonical = productionConfigs(env, "canonical");
    const legacy = productionConfigs(env, "legacy");
    expect(canonical["gateway"]?.routes).toHaveLength(2);
    expect(legacy["gateway"]?.routes).toHaveLength(7);
    expect(legacy["link"]?.routes).toEqual([
      { pattern: "link.zarkiv.com", custom_domain: true },
    ]);
  });

  it("refuses placeholder resource ids", () => {
    expect(() =>
      productionConfigs(
        {
          ...env,
          ZARKIV_LINK_D1_ID: "00000000-0000-0000-0000-000000000000",
        },
        "none",
      ),
    ).toThrow(/ZARKIV_LINK_D1_ID/u);
  });

  it("ignores unrelated GitHub runner environment variables", () => {
    const runnerEnvironment = {
      ...env,
      DOTNET_MULTILEVEL_LOOKUP: "0",
    };

    expect(() => productionConfigs(runnerEnvironment, "none")).not.toThrow();
  });
});

describe("production secrets", () => {
  it("maps repository secret names to Worker bindings", () => {
    const result = productionSecrets({
      ZARKIV_PASS_RESEND_API_KEY: "resend",
      ZARKIV_TURNSTILE_SECRET_KEY: "turnstile",
      ZARKIV_PASS_IP_HASH_SECRET: "audit",
      ZARKIV_DROP_GUEST_HASH_SECRET: "guest",
      ZARKIV_DROP_DOWNLOAD_SIGNING_SECRET: "download",
      ZARKIV_DROP_PASSWORD_HASH_SECRET: "password",
    });
    expect(result.pass).toEqual({
      RESEND_API_KEY: "resend",
      TURNSTILE_SECRET_KEY: "turnstile",
      IP_HASH_SECRET: "audit",
    });
    expect(result.drop.PASSWORD_HASH_SECRET).toBe("password");
  });
});
