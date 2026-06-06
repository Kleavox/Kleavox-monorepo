export type DomainMode = "none" | "canonical" | "legacy";

export interface DeployEnvironment {
  CLOUDFLARE_ACCOUNT_ID: string;
  ZARKIV_PASS_D1_ID: string;
  ZARKIV_PASS_KV_ID: string;
  ZARKIV_LINK_D1_ID: string;
  ZARKIV_PULSE_D1_ID: string;
  ZARKIV_DROP_D1_ID: string;
  ZARKIV_DROP_BUCKET?: string;
}

interface Route {
  pattern: string;
  custom_domain: true;
}

type WorkerConfig = Record<string, unknown>;

const base = {
  compatibility_date: "2026-06-05",
  workers_dev: true,
  preview_urls: false,
  observability: { enabled: true },
};

export function productionConfigs(
  env: DeployEnvironment,
  domains: DomainMode,
): Record<string, WorkerConfig> {
  validateEnvironment(env);
  const canonical = domains === "canonical" || domains === "legacy";

  return {
    pass: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: "zarkiv-pass",
      main: "../../workers/pass/src/index.ts",
      assets: {
        directory: "../../apps/pass/dist",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api/*", "/internal/*", "/health", "/ready"],
      },
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_ORIGIN: "https://pass.zarkiv.com",
        ROOT_DOMAIN: "zarkiv.com",
        FROM_EMAIL: "Zarkiv <no-reply@zarkiv.com>",
      },
      kv_namespaces: [{ binding: "SESSIONS", id: env.ZARKIV_PASS_KV_ID }],
      d1_databases: [
        {
          binding: "DB",
          database_name: "zarkiv-pass",
          database_id: env.ZARKIV_PASS_D1_ID,
          migrations_dir: "../../workers/pass/migrations",
        },
      ],
      ...(canonical ? { routes: routes("pass.zarkiv.com") } : {}),
    },
    link: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: "zarkiv-link",
      main: "../../workers/link/src/index.ts",
      assets: {
        directory: "../../apps/link/dist",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api/*", "/internal/*", "/health"],
      },
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_SHORT_ORIGIN: "https://zarkiv.com",
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: "zarkiv-link",
          database_id: env.ZARKIV_LINK_D1_ID,
          migrations_dir: "../../workers/link/migrations",
        },
      ],
      services: [
        { binding: "PASS", service: "zarkiv-pass" },
        { binding: "DROP", service: "zarkiv-drop" },
      ],
      ratelimits: [rateLimit("PUBLIC_CREATE_RATE_LIMIT", "3201", 10)],
      ...(canonical
        ? { routes: routes("link.zarkiv.com", "drop.zarkiv.com") }
        : {}),
    },
    pulse: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: "zarkiv-pulse",
      main: "../../workers/pulse/src/index.ts",
      assets: {
        directory: "../../apps/pulse/dist",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api/*", "/internal/*", "/health"],
      },
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_ORIGIN: "https://pulse.zarkiv.com",
        AGENT_DOWNLOAD_BASE:
          "https://github.com/zarkiv/zarkiv/releases/latest/download",
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: "zarkiv-pulse",
          database_id: env.ZARKIV_PULSE_D1_ID,
          migrations_dir: "../../workers/pulse/migrations",
        },
      ],
      services: [{ binding: "PASS", service: "zarkiv-pass" }],
      triggers: { crons: ["17 3 * * *"] },
      ...(canonical ? { routes: routes("pulse.zarkiv.com") } : {}),
    },
    drop: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: "zarkiv-drop",
      main: "../../workers/drop/src/index.ts",
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_ORIGIN: "https://link.zarkiv.com",
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: "zarkiv-drop",
          database_id: env.ZARKIV_DROP_D1_ID,
          migrations_dir: "../../workers/drop/migrations",
        },
      ],
      r2_buckets: [
        {
          binding: "FILES",
          bucket_name: env.ZARKIV_DROP_BUCKET ?? "zarkiv-drop",
        },
      ],
      services: [{ binding: "PASS", service: "zarkiv-pass" }],
      ratelimits: [
        rateLimit("CREATE_RATE_LIMIT", "3101", 12),
        rateLimit("DOWNLOAD_RATE_LIMIT", "3102", 120),
        rateLimit("REPORT_RATE_LIMIT", "3103", 5),
      ],
      triggers: { crons: ["*/15 * * * *"] },
    },
    portfolio: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: "zarkiv-portfolio",
      main: "../../workers/portfolio/src/index.ts",
      vars: {
        CONTACT_EMAIL: "port@deau.site",
        FROM_EMAIL: "Zarkiv Port <no-reply@zarkiv.com>",
      },
      assets: {
        directory: "../../apps/portfolio/dist",
        binding: "ASSETS",
        not_found_handling: "404-page",
        run_worker_first: ["/health", "/api/contact"],
      },
      ratelimits: [rateLimit("CONTACT_RATE_LIMIT", "3301", 3)],
      ...(canonical ? { routes: routes("port.zarkiv.com") } : {}),
    },
    gateway: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: "zarkiv-gateway",
      main: "../../workers/gateway/src/index.ts",
      assets: {
        directory: "../../apps/web/dist",
        binding: "ASSETS",
        not_found_handling: "404-page",
        run_worker_first: true,
      },
      services: [{ binding: "LINK", service: "zarkiv-link" }],
      ...(canonical
        ? {
            routes: [
              ...routes("zarkiv.com", "www.zarkiv.com"),
              ...(domains === "legacy"
                ? routes(
                    "deau.site",
                    "port.deau.site",
                    "bit.deau.site",
                    "one.deau.site",
                    "board.deau.site",
                  )
                : []),
            ],
          }
        : {}),
    },
  };
}

export function productionSecrets(env: NodeJS.ProcessEnv) {
  return {
    pass: requiredSecrets(
      env,
      [
        "ZARKIV_PASS_RESEND_API_KEY",
        "ZARKIV_TURNSTILE_SECRET_KEY",
        "ZARKIV_PASS_IP_HASH_SECRET",
        "ZARKIV_PASS_GOOGLE_CLIENT_ID",
        "ZARKIV_PASS_GOOGLE_CLIENT_SECRET",
        "ZARKIV_PASS_GITHUB_CLIENT_ID",
        "ZARKIV_PASS_GITHUB_CLIENT_SECRET",
      ],
      {
        ZARKIV_PASS_RESEND_API_KEY: "RESEND_API_KEY",
        ZARKIV_TURNSTILE_SECRET_KEY: "TURNSTILE_SECRET_KEY",
        ZARKIV_PASS_IP_HASH_SECRET: "IP_HASH_SECRET",
        ZARKIV_PASS_GOOGLE_CLIENT_ID: "GOOGLE_CLIENT_ID",
        ZARKIV_PASS_GOOGLE_CLIENT_SECRET: "GOOGLE_CLIENT_SECRET",
        ZARKIV_PASS_GITHUB_CLIENT_ID: "GITHUB_CLIENT_ID",
        ZARKIV_PASS_GITHUB_CLIENT_SECRET: "GITHUB_CLIENT_SECRET",
      },
    ),
    drop: requiredSecrets(
      env,
      [
        "ZARKIV_TURNSTILE_SECRET_KEY",
        "ZARKIV_DROP_GUEST_HASH_SECRET",
        "ZARKIV_DROP_DOWNLOAD_SIGNING_SECRET",
        "ZARKIV_DROP_PASSWORD_HASH_SECRET",
      ],
      {
        ZARKIV_TURNSTILE_SECRET_KEY: "TURNSTILE_SECRET_KEY",
        ZARKIV_DROP_GUEST_HASH_SECRET: "GUEST_HASH_SECRET",
        ZARKIV_DROP_DOWNLOAD_SIGNING_SECRET: "DOWNLOAD_SIGNING_SECRET",
        ZARKIV_DROP_PASSWORD_HASH_SECRET: "PASSWORD_HASH_SECRET",
      },
    ),
    portfolio: requiredSecrets(
      env,
      ["ZARKIV_PASS_RESEND_API_KEY", "ZARKIV_TURNSTILE_SECRET_KEY"],
      {
        ZARKIV_PASS_RESEND_API_KEY: "RESEND_API_KEY",
        ZARKIV_TURNSTILE_SECRET_KEY: "TURNSTILE_SECRET_KEY",
      },
    ),
  };
}

function routes(...patterns: string[]): Route[] {
  return patterns.map((pattern) => ({ pattern, custom_domain: true }));
}

function rateLimit(name: string, namespaceId: string, limit: number) {
  return {
    name,
    namespace_id: namespaceId,
    simple: { limit, period: 60 },
  };
}

function validateEnvironment(env: DeployEnvironment) {
  const requiredKeys = [
    "CLOUDFLARE_ACCOUNT_ID",
    "ZARKIV_PASS_D1_ID",
    "ZARKIV_PASS_KV_ID",
    "ZARKIV_LINK_D1_ID",
    "ZARKIV_PULSE_D1_ID",
    "ZARKIV_DROP_D1_ID",
  ] as const satisfies readonly (keyof DeployEnvironment)[];

  for (const key of requiredKeys) {
    const value = env[key];
    if (!value || /^0+$|00000000-0000-0000-0000-000000000000$/u.test(value)) {
      throw new Error(`Missing or placeholder deployment value: ${key}`);
    }
  }
}

function requiredSecrets(
  env: NodeJS.ProcessEnv,
  names: string[],
  outputNames: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    const value = env[name];
    if (!value) throw new Error(`Missing deployment secret: ${name}`);
    result[outputNames[name]!] = value;
  }
  return result;
}
