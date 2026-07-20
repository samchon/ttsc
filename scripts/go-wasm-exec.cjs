// Trim the inherited Windows environment before Go's wasm runner serializes it.
//
// Go's js/wasm runtime copies process.env into the wasm program. Development
// shells can exceed its command-line limit, even though the test itself needs
// no inherited configuration beyond the normal process and temporary paths.

const path = require("node:path");

const wasmExec = process.argv[2];
if (!wasmExec) {
  throw new Error("go-wasm-exec.cjs: missing wasm_exec_node.js path");
}

const keep = new Set([
  "ComSpec",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "TEMP",
  "TTSC_WASM_TEST_ROOT",
  "TMP",
  "USERPROFILE",
]);
for (const key of Object.keys(process.env)) {
  if (!keep.has(key)) delete process.env[key];
}

process.argv = [
  process.argv[0],
  path.resolve(wasmExec),
  ...process.argv.slice(3),
];
require(process.argv[1]);
