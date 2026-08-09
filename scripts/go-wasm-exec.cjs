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

// Read before the environment is trimmed, so the knob never reaches the wasm
// program and never has to be kept for it.
const overrunSeconds = Number(process.env.TTSC_WASM_EXEC_TIMEOUT ?? "120");

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

// Report what node is still waiting on when the program overruns, instead of
// leaving cmd/go to kill it eleven minutes later with nothing to read.
//
// `packages/wasm/test/host` finishes in under a second on 78 of 81 measured
// runs and hangs on the rest, always after the suite has printed `PASS`. The
// kill that follows lands on this node process rather than on a Go one, and
// node cannot dump goroutines living inside the wasm module, so every
// occurrence so far produced no evidence at all (#1089).
//
// The wasm program runs inside this process, so its pending work is node's
// pending work, and node can be asked. The timer is unreferenced, so a healthy
// run exits before it is ever consulted and nothing here can hold a process
// open that would otherwise close.
if (Number.isFinite(overrunSeconds) && overrunSeconds > 0) {
  const watchdog = setTimeout(() => {
    const resources =
      typeof process.getActiveResourcesInfo === "function"
        ? process.getActiveResourcesInfo()
        : ["unavailable on this node version"];
    process.stderr.write(
      `go-wasm-exec: the wasm program has not exited after ${overrunSeconds}s.
` +
        `go-wasm-exec: node is still holding ${JSON.stringify(resources)}.
` +
        `go-wasm-exec: see https://github.com/samchon/ttsc/issues/1089.
`,
    );
    process.exit(1);
  }, overrunSeconds * 1000);
  watchdog.unref();
}

process.argv = [
  process.argv[0],
  path.resolve(wasmExec),
  ...process.argv.slice(3),
];
require(process.argv[1]);
