import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const env = {
  ...process.env,
  VITE_ROOT_ORIGIN: "http://127.0.0.1:8786",
  VITE_PASS_ORIGIN: "http://127.0.0.1:8787",
  VITE_LINK_ORIGIN: "http://127.0.0.1:8788",
  VITE_PULSE_ORIGIN: "http://127.0.0.1:8790",
  PUBLIC_ROOT_ORIGIN: "http://127.0.0.1:8786",
};

execSync(
  "pnpm exec turbo run build --filter=@kleavox/pass-app --filter=@kleavox/link-app --filter=@kleavox/web-app",
  { cwd: repoRoot, env, stdio: "inherit" },
);

for (const worker of ["pass", "link", "drop"]) {
  rmSync(path.join(repoRoot, "workers", worker, ".wrangler", "state"), {
    recursive: true,
    force: true,
  });
  execSync(
    `pnpm exec wrangler d1 migrations apply DB --local --config workers/${worker}/wrangler.jsonc`,
    { cwd: repoRoot, env, stdio: "inherit" },
  );
}
