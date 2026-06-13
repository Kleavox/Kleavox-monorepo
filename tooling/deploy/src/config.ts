export type DomainMode = "none" | "canonical";

export interface DeployEnvironment {
  CLOUDFLARE_ACCOUNT_ID: string;
  APP_ROOT_DOMAIN: string;
  WORKER_PREFIX: string;
  PASS_D1_ID: string;
  PASS_KV_ID: string;
  LINK_D1_ID: string;
  PULSE_D1_ID: string;
  DROP_D1_ID: string;
  DROP_BUCKET_NAME: string;
  AUTH_FROM_EMAIL: string;
  AGENT_DOWNLOAD_BASE: string;
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

  const rootDomain = normalizeDomain(env.APP_ROOT_DOMAIN);
  const rootOrigin = `https://${rootDomain}`;
  const prefix = normalizeWorkerPrefix(env.WORKER_PREFIX);
  const canonical = domains === "canonical";
  const names = {
    pass: `${prefix}-pass`,
    link: `${prefix}-link`,
    pulse: `${prefix}-pulse`,
    drop: `${prefix}-drop`,
    portfolio: `${prefix}-portfolio`,
    gateway: `${prefix}-gateway`,
  };
  const host = (subdomain: string) => `${subdomain}.${rootDomain}`;

  return {
    pass: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: names.pass,
      main: "../../workers/pass/src/index.ts",
      assets: {
        directory: "../../apps/pass/dist",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api/*", "/internal/*", "/health", "/ready"],
      },
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_ORIGIN: `https://${host("pass")}`,
        ROOT_DOMAIN: rootDomain,
        FROM_EMAIL: env.AUTH_FROM_EMAIL,
      },
      kv_namespaces: [{ binding: "SESSIONS", id: env.PASS_KV_ID }],
      d1_databases: [
        {
          binding: "DB",
          database_name: names.pass,
          database_id: env.PASS_D1_ID,
          migrations_dir: "../../workers/pass/migrations",
        },
      ],
      services: [
        { binding: "LINK", service: names.link },
        { binding: "DROP", service: names.drop },
      ],
      ...(canonical ? { routes: routes(host("pass")) } : {}),
    },
    link: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: names.link,
      main: "../../workers/link/src/index.ts",
      assets: {
        directory: "../../apps/link/dist",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api/*", "/internal/*", "/health"],
      },
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_SHORT_ORIGIN: rootOrigin,
        PUBLIC_APP_ORIGIN: `https://${host("link")}`,
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: names.link,
          database_id: env.LINK_D1_ID,
          migrations_dir: "../../workers/link/migrations",
        },
      ],
      services: [
        { binding: "PASS", service: names.pass },
        { binding: "DROP", service: names.drop },
        { binding: "PULSE", service: names.pulse },
      ],
      ratelimits: [rateLimit("PUBLIC_CREATE_RATE_LIMIT", "3201", 10)],
      ...(canonical ? { routes: routes(host("link")) } : {}),
    },
    pulse: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: names.pulse,
      main: "../../workers/pulse/src/index.ts",
      assets: {
        directory: "../../apps/pulse/dist",
        binding: "ASSETS",
        not_found_handling: "single-page-application",
        run_worker_first: ["/api/*", "/internal/*", "/health"],
      },
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_ORIGIN: `https://${host("pulse")}`,
        AGENT_DOWNLOAD_BASE: env.AGENT_DOWNLOAD_BASE,
        FROM_EMAIL: env.AUTH_FROM_EMAIL,
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: names.pulse,
          database_id: env.PULSE_D1_ID,
          migrations_dir: "../../workers/pulse/migrations",
        },
      ],
      services: [
        { binding: "PASS", service: names.pass },
        { binding: "LINK", service: names.link },
        { binding: "DROP", service: names.drop },
      ],
      triggers: { crons: ["17 3 * * *"] },
      ...(canonical ? { routes: routes(host("pulse")) } : {}),
    },
    drop: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: names.drop,
      main: "../../workers/drop/src/index.ts",
      vars: {
        ENVIRONMENT: "production",
        PUBLIC_ORIGIN: rootOrigin,
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: names.drop,
          database_id: env.DROP_D1_ID,
          migrations_dir: "../../workers/drop/migrations",
        },
      ],
      r2_buckets: [
        {
          binding: "FILES",
          bucket_name: env.DROP_BUCKET_NAME,
        },
      ],
      services: [
        { binding: "PASS", service: names.pass },
        { binding: "PULSE", service: names.pulse },
      ],
      ratelimits: [
        rateLimit("CREATE_RATE_LIMIT", "3101", 12),
        rateLimit("DOWNLOAD_RATE_LIMIT", "3102", 120),
        rateLimit("REPORT_RATE_LIMIT", "3103", 5),
      ],
      triggers: { crons: ["*/15 * * * *"] },
    },
    gateway: {
      ...base,
      account_id: env.CLOUDFLARE_ACCOUNT_ID,
      name: names.gateway,
      main: "../../workers/gateway/src/index.ts",
      vars: {
        PUBLIC_ORIGIN: rootOrigin,
      },
      assets: {
        directory: "../../apps/web/dist",
        binding: "ASSETS",
        not_found_handling: "404-page",
        run_worker_first: true,
      },
      services: [
        { binding: "LINK", service: names.link },
        { binding: "DROP", service: names.drop },
        { binding: "PASS", service: names.pass },
        { binding: "PULSE", service: names.pulse },
        { binding: "PORTFOLIO", service: names.portfolio },
      ],
      ...(canonical ? { routes: routes(rootDomain, `www.${rootDomain}`) } : {}),
    },
  };
}

export function productionSecrets(env: NodeJS.ProcessEnv) {
  return {
    pass: selectSecrets(env, [
      "RESEND_API_KEY",
      "TURNSTILE_SECRET_KEY",
      "IP_HASH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
    ]),
    drop: selectSecrets(env, [
      "TURNSTILE_SECRET_KEY",
      "GUEST_HASH_SECRET",
      "DOWNLOAD_SIGNING_SECRET",
      "PASSWORD_HASH_SECRET",
    ]),
    pulse: selectSecrets(env, ["RESEND_API_KEY"]),
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
    "APP_ROOT_DOMAIN",
    "WORKER_PREFIX",
    "PASS_D1_ID",
    "PASS_KV_ID",
    "LINK_D1_ID",
    "PULSE_D1_ID",
    "DROP_D1_ID",
    "DROP_BUCKET_NAME",
    "AUTH_FROM_EMAIL",
    "AGENT_DOWNLOAD_BASE",
  ] as const satisfies readonly (keyof DeployEnvironment)[];

  for (const key of requiredKeys) {
    const value = env[key];
    if (
      !value ||
      /^0+$|00000000-0000-0000-0000-000000000000$/u.test(value) ||
      /^(replace-me|example|example\.com)$/iu.test(value)
    ) {
      throw new Error(`Missing or placeholder deployment value: ${key}`);
    }
  }
}

function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/\.$/u, "");
  if (
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u.test(
      domain,
    )
  ) {
    throw new Error("APP_ROOT_DOMAIN must be a valid hostname.");
  }
  return domain;
}

function normalizeWorkerPrefix(value: string): string {
  const prefix = value.trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]{1,30}[a-z0-9]$/u.test(prefix)) {
    throw new Error("WORKER_PREFIX must be a valid Worker name prefix.");
  }
  return prefix;
}

function selectSecrets(
  env: NodeJS.ProcessEnv,
  names: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of names) {
    const value = env[name];
    if (!value) throw new Error(`Missing deployment secret: ${name}`);
    result[name] = value;
  }
  return result;
}
