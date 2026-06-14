import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const local = hasFlag("--local");
const list = hasFlag("--list");
const rawEmail = optionValue("--email");

const EMAIL_PATTERN = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

try {
  if (list) {
    printAdmins();
  } else {
    promote();
  }
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}

function promote() {
  if (!rawEmail) {
    throw new Error(
      "Missing --email. Usage: promote-admin.mjs --email you@example.com [--local]",
    );
  }
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    throw new Error(
      `Refusing to use an unsafe or malformed email: ${rawEmail}`,
    );
  }

  const accounts = query(
    `SELECT email, role, email_verified_at FROM users WHERE email = '${email}'`,
  );
  const account = accounts[0];
  if (!account) {
    throw new Error(
      `No account for ${email}. Register and verify it in Pass first, then re-run.`,
    );
  }
  if (account.role === "ADMIN") {
    console.log(`${email} is already an ADMIN. Nothing to do.`);
    printAdmins();
    return;
  }

  run(
    `UPDATE users SET role='ADMIN', updated_at=datetime('now') WHERE email='${email}'`,
  );
  console.log(`\nPromoted ${email} to ADMIN.`);

  if (!account.email_verified_at) {
    console.warn(
      "\nWarning: this account's email is NOT verified. Pulse report-notification\n" +
        "emails only go to verified admins, so verify the address in Pass to receive them.",
    );
  }

  printAdmins();
}

function printAdmins() {
  const admins = query(
    "SELECT email, role FROM users WHERE role='ADMIN' ORDER BY email",
  );
  if (admins.length === 0) {
    console.log("\nNo ADMIN accounts exist yet.");
    return;
  }
  console.log("\nCurrent admins:");
  console.table(admins);
}

function query(sql) {
  const stdout = wrangler(sql, { capture: true });
  try {
    const parsed = JSON.parse(stdout);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    return first?.results ?? [];
  } catch {
    throw new Error(`Could not parse wrangler output:\n${stdout}`);
  }
}

function run(sql) {
  wrangler(sql, { capture: false });
}

function wrangler(sql, { capture }) {
  const wranglerArgs = ["exec", "wrangler", "d1", "execute", "DB"];
  wranglerArgs.push(local ? "--local" : "--remote");
  wranglerArgs.push("--config", configPath());
  wranglerArgs.push("--command", sql);
  if (capture) wranglerArgs.push("--json");

  const onWindows = process.platform === "win32";
  const finalArgs = onWindows ? wranglerArgs.map(quoteArg) : wranglerArgs;

  const result = spawnSync("pnpm", finalArgs, {
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    shell: onWindows,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`wrangler exited with code ${result.status ?? "unknown"}.`);
  }
  return result.stdout ?? "";
}

let cachedConfigPath;

function configPath() {
  if (local) return "workers/pass/wrangler.jsonc";
  if (cachedConfigPath) return cachedConfigPath;

  const prefix = requiredEnv("WORKER_PREFIX");
  const databaseId = requiredEnv("PASS_D1_ID");
  const dir = mkdtempSync(join(tmpdir(), "kvx-promote-"));
  cachedConfigPath = join(dir, "pass.json");
  writeFileSync(
    cachedConfigPath,
    JSON.stringify({
      name: `${prefix}-pass`,
      compatibility_date: "2026-06-05",
      d1_databases: [
        {
          binding: "DB",
          database_name: `${prefix}-pass`,
          database_id: databaseId,
        },
      ],
    }),
  );
  process.on("exit", () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      void 0;
    }
  });
  return cachedConfigPath;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing environment variable ${name} (required for --remote). ` +
        "Set WORKER_PREFIX and PASS_D1_ID, or use --local.",
    );
  }
  return value;
}

function quoteArg(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function hasFlag(name) {
  return args.includes(name);
}

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}
