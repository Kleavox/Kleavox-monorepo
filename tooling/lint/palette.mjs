import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const BUDGET = { link: 3, pass: 0, pulse: 0, web: 0 };
const EXTENSIONS = [".css", ".ts", ".tsx", ".js", ".jsx"];

const tokens = new Set(
  [
    ...readFileSync(
      resolve(root, "packages/ui/src/styles.css"),
      "utf8",
    ).matchAll(/--(?:kvx|dt)-[a-z0-9-]+:\s*(#[0-9a-fA-F]{3,8})\s*;/g),
  ].map((match) => expand(match[1])),
);

function expand(hex) {
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex.slice(0, 7);
  return full.toLowerCase();
}

function offPalette(app) {
  const base = resolve(root, "apps", app, "src");
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", "dist"].includes(entry.name)) continue;
        walk(path);
        continue;
      }
      if (!EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
        continue;
      }
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (tokens.has(expand(match[0]))) continue;
        found.push(
          `${relative(root, path).split("\\").join("/")}:${
            source.slice(0, match.index).split("\n").length
          }  ${match[0]}`,
        );
      }
    }
  };
  walk(base);
  return found;
}

let failed = false;
for (const [app, budget] of Object.entries(BUDGET)) {
  const offences = offPalette(app);
  if (offences.length > budget) {
    failed = true;
    console.error(
      `${app}: ${offences.length} off-palette colours, budget ${budget}`,
    );
    for (const offence of offences) console.error(`  ${offence}`);
  }
}

if (failed) process.exit(1);
console.log("palette: clean");
