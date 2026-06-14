// Dead-code guard for the Go agent service.
//
// `deadcode` prints unreachable functions to stdout but exits 0 even when it
// finds them, so this wrapper turns any finding into a non-zero exit. Kept as a
// node script (not a shell one-liner) so it runs the same on Windows and CI.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../../services/agent", import.meta.url));

let output = "";
try {
  output = execFileSync(
    "go",
    ["run", "golang.org/x/tools/cmd/deadcode@latest", "./..."],
    { cwd, encoding: "utf8" },
  );
} catch (error) {
  process.stderr.write(error.stdout ?? "");
  process.stderr.write(error.stderr ?? "");
  process.stderr.write("\ndeadcode failed to run\n");
  process.exit(1);
}

if (output.trim()) {
  process.stderr.write("Dead Go code found:\n" + output + "\n");
  process.exit(1);
}

process.stdout.write("Go deadcode: clean\n");
