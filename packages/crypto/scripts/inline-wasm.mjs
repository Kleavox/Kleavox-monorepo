import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, "..", "pkg", "kleavox_crypto_bg.wasm");
const outPath = join(__dirname, "..", "src", "wasm-base64.ts");

async function run() {
  const buffer = await fs.readFile(wasmPath);
  const base64 = buffer.toString("base64");
  const content = `export const WASM_BASE64 = "${base64}";\n`;
  await fs.writeFile(outPath, content);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
