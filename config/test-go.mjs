import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Keep independent Go populations observable when native tests fail. Go owns
// package discovery, per-package timeouts and the final test verdicts.
const root = fileURLToPath(new URL("../", import.meta.url));
const native = run([
  "test",
  "-count=1",
  ...["banner", "evidence", "lint", "paths", "strip", "ttsc", "wasm"].map(
    (name) => `./packages/${name}/...`,
  ),
  // Recursive Go patterns stop at nested module boundaries, including shims.
  ...["shim/ast", "shim/vfs", "tools/gen_facade", "tools/gen_shims", "tools/shim_audit"].map(
    (name) => `./packages/ttsc/${name}/...`,
  ),
]);
// This maintained fixture has its own dependency-free module outside go.work.
// Run its direct units independently without changing consumer workspace inputs.
const transformer = run([
  "-C", "packages/ttsc/test/go-transformer", "test", "-count=1", "./...",
], { ...process.env, GOWORK: "off" });
// The process-lifetime observer is another standalone fixture module. Its
// original-handle units must run even when another Go population fails.
const observer = run([
  "-C", "packages/ttsc/test/fixtures/process-observer", "test", "-count=1", "./...",
], { ...process.env, GOWORK: "off" });
// The shared native cache-probe fixture owns its portable gate receipt tests.
// Keep this standalone module independent of product and observer failures.
const nativeFixture = run([
  "-C", "packages/unplugin/test/fixtures/native-transform-producer", "test", "-count=1", ".",
], { ...process.env, GOWORK: "off" });
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
    "--stack-size=8192",
    fileURLToPath(new URL("../packages/wasm/test/go-js-wasm-exec.mjs", import.meta.url)),
    path.join(toolchain.stdout.trim(), "lib", "wasm", "wasm_exec_node.js"),
  ].map((word) => {
    const value = process.platform === "win32" ? word.replaceAll("\\", "/") : word;
    const quote = value.includes('"') ? "'" : '"';
    if (value.includes(quote)) throw new Error("Go -exec cannot quote a path containing both quote characters");
    return `${quote}${value}${quote}`;
  }).join(" ");
  // This Node process is also the actual WASM runtime. Prevent inherited
  // preload/options from taking effect before its launcher trims the env.
  wasm = run([
    "-C", "packages/wasm", "test", "-count=1", "-exec", command, "./test/host",
  ], { ...process.env, NODE_OPTIONS: "", GOOS: "js", GOARCH: "wasm" });
} else {
  console.error(toolchain.error ?? `Cannot locate the Go WASM runner (go env GOROOT exited ${toolchain.status}): ${toolchain.stderr}`);
}
process.exitCode = native || transformer || observer || nativeFixture || wasm;

// Await each complete Go population and retain launch failures and native
// child exit codes. No command shell interprets Go arguments or environment.
function run(args, env = process.env) {
  const result = spawnSync("go", args, { cwd: root, env, stdio: "inherit" });
  if (result.error) console.error(result.error);
  if (result.signal) console.error(`Go test terminated by ${result.signal}`);
  return result.status ?? 1;
}
