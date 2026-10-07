import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep both independent populations observable when native tests fail. Go owns
// package discovery, per-package timeouts and the final test verdicts.
const root = fileURLToPath(new URL("../", import.meta.url));
const native = run([
  "test",
  "-count=1",
  ...["banner", "evidence", "lint", "paths", "strip", "ttsc", "wasm"].map(
    (name) => `./packages/${name}/...`,
  ),
]);
const toolchain = spawnSync("go", ["env", "GOROOT"], {
  cwd: root,
  encoding: "utf8",
});
let wasm = 1;
if (toolchain.status === 0) {
  // Go splits -exec itself, rather than passing it through a shell. Forward
  // slashes and quoted words preserve Windows drive paths and spaces there.
  const command = [
    process.execPath,
    fileURLToPath(new URL("../packages/wasm/test/go-js-wasm-exec.mjs", import.meta.url)),
    path.join(toolchain.stdout.trim(), "lib", "wasm", "wasm_exec_node.js"),
  ].map((word) => {
    const value = process.platform === "win32" ? word.replaceAll("\\", "/") : word;
    const quote = value.includes('"') ? "'" : '"';
    if (value.includes(quote)) throw new Error("Go -exec cannot quote a path containing both quote characters");
    return `${quote}${value}${quote}`;
  }).join(" ");
  wasm = run([
    "-C", "packages/wasm", "test", "-count=1", "-exec", command, "./test/host",
  ], { ...process.env, GOOS: "js", GOARCH: "wasm" });
} else {
  console.error(toolchain.error ?? `Cannot locate the Go WASM runner (go env GOROOT exited ${toolchain.status}): ${toolchain.stderr}`);
}
process.exitCode = native || wasm;

// Await each complete Go population and retain launch failures and native
// child exit codes. No command shell interprets Go arguments or environment.
function run(args, env = process.env) {
  const result = spawnSync("go", args, { cwd: root, env, stdio: "inherit" });
  if (result.error) console.error(result.error);
  if (result.signal) console.error(`Go test terminated by ${result.signal}`);
  return result.status ?? 1;
}
