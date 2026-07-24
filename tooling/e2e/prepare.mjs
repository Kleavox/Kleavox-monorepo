import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { localWorkerOrigin } from "@kleavox/topology";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const env = {
  ...process.env,
  VITE_ROOT_ORIGIN: localWorkerOrigin("gateway"),
  VITE_PASS_ORIGIN: localWorkerOrigin("pass"),
  VITE_LINK_ORIGIN: localWorkerOrigin("link"),
  VITE_PULSE_ORIGIN: localWorkerOrigin("pulse"),
  PUBLIC_ROOT_ORIGIN: localWorkerOrigin("gateway"),
};

execSync(
  "pnpm exec turbo run build --filter=@kleavox/gateway-worker^... --filter=@kleavox/pass-worker^... --filter=@kleavox/link-worker^...",
  { cwd: repoRoot, env, stdio: "inherit" },
);

for (const worker of ["pass", "link"]) {
  rmSync(path.join(repoRoot, "workers", worker, ".wrangler", "state"), {
    recursive: true,
    force: true,
  });
  execSync(
    `pnpm exec wrangler d1 migrations apply DB --local --config workers/${worker}/wrangler.jsonc`,
    { cwd: repoRoot, env, stdio: "inherit" },
  );
}
