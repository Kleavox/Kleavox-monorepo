#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { migrateDeauBit, type MigrationFile } from "./deaubit.js";
import { migrateDeauBoard } from "./deauboard.js";
import { rowsFromD1Json } from "./sql.js";

const [command, ...argumentsList] = process.argv.slice(2);
const options = parseOptions(argumentsList);

try {
  if (command === "deaubit") {
    const result = migrateDeauBit({
      users: await readRows(requiredOption(options, "users")),
      links: await readRows(requiredOption(options, "links")),
      clicks: await readRows(requiredOption(options, "clicks")),
      reports: await readRows(requiredOption(options, "reports")),
    });
    await writeResult(requiredOption(options, "out"), result.files, result.manifest);
  } else if (command === "deauboard") {
    const result = migrateDeauBoard({
      ownerUserId: requiredOption(options, "owner-user-id"),
      projects: await readRows(requiredOption(options, "projects")),
      checks: await readRows(requiredOption(options, "checks")),
      notes: await readRows(requiredOption(options, "notes")),
    });
    await writeResult(requiredOption(options, "out"), result.files, result.manifest);
  } else {
    usage();
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

async function readRows(path: string) {
  return rowsFromD1Json(JSON.parse(await readFile(resolve(path), "utf8")));
}

async function writeResult(
  outputPath: string,
  files: MigrationFile[],
  manifest: object,
) {
  const directory = resolve(outputPath);
  await mkdir(directory, { recursive: true });
  for (const file of files) {
    await writeFile(resolve(directory, file.name), file.sql, "utf8");
  }
  await writeFile(
    resolve(directory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
  console.log(`Wrote ${files.length} SQL files and manifest.json to ${directory}`);
}

function parseOptions(values: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(`Invalid option near ${key ?? "end of command"}.`);
    }
    result.set(key.slice(2), value);
  }
  return result;
}

function requiredOption(optionsMap: Map<string, string>, name: string): string {
  const value = optionsMap.get(name);
  if (!value) throw new Error(`Missing required option --${name}.`);
  return value;
}

function usage() {
  console.error(`Usage:
  zarkiv-migrate deaubit --users users.json --links links.json --clicks clicks.json --reports reports.json --out output
  zarkiv-migrate deauboard --owner-user-id UUID --projects projects.json --checks checks.json --notes notes.json --out output`);
}
