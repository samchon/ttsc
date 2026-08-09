// Trim the inherited Windows environment before Go's wasm runner serializes it.
//
// Go's js/wasm runtime copies process.env into the wasm program. Development
// shells can exceed its command-line limit, even though the test itself needs
// no inherited configuration beyond the normal process and temporary paths.

const fs = require("node:fs");
const path = require("node:path");

const wasmExec = process.argv[2];
if (!wasmExec) {
  throw new Error("go-wasm-exec.cjs: missing wasm_exec_node.js path");
}

// Read before the environment is trimmed, so the knob never reaches the wasm
// program and never has to be kept for it.
const overrunSeconds = backstopSeconds(process.env.TTSC_WASM_EXEC_TIMEOUT);

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

// Terminate a wasm program whose own guard could not, and say what node was
// still holding.
//
// The suite's Go-side guard is the one that produces the useful artifact: it
// dumps every goroutine stack, which is what `go test`'s eleven-minute kill
// cannot, because that kill reaches node and node has no goroutines to report
// (#1089). This exists only for the case that guard cannot cover, where the Go
// runtime is wedged so completely that its own timer never runs. It is
// therefore deliberately slower than the Go budget: whichever fires first ends
// the process, and the richer artifact must always win the race.
//
// The reading is per-handle as well as the type-name summary, because a handle
// carries an fd, a pending byte count, and a constructor name that a type name
// does not.
//
// An earlier note here claimed the summary reads `["PipeWrap","Timeout"]`
// whether the suite is healthy or wedged, and so distinguishes nothing. That
// was measured against this file's own test stub, which writes through
// `process.stdout` and therefore materializes a socket. The wasm program does
// not: `wasm_exec_node.js` binds node's `fs` and the program writes through
// `fs.write`, so no such handle ever exists and the summary does discriminate.
// The suite's own guard reads it for exactly that reason.
//
// The timer is unreferenced, so it can never hold open a process that would
// otherwise close. That is independent of the budget: a healthy run of this
// suite exits in about a second and never reaches the callback at all.
if (overrunSeconds > 0) {
  const backstop = setTimeout(() => {
    // fs.writeSync rather than process.stderr.write, because stdio to a pipe is
    // asynchronous on macOS and process.exit does not flush a pending write.
    // The Go-side guard bypasses its own stderr for a neighbouring reason.
    fs.writeSync(
      2,
      `go-wasm-exec: the wasm program has not exited after ${overrunSeconds}s,` +
        ` and its own guard did not report first.\n` +
        `go-wasm-exec: node is still holding ${describeHandles()}\n` +
        `go-wasm-exec: see https://github.com/samchon/ttsc/issues/1089.\n`,
    );
    process.exit(1);
  }, overrunSeconds * 1000);
  backstop.unref();
}

// backstopSeconds reads the budget, refusing a value it cannot honor.
//
// A misspelled knob used to disable the guard in silence, which is
// indistinguishable from having it, so a lane could lose its only backstop
// without saying so. `0` stays a deliberate way to switch it off, and the
// ceiling is node's own: a delay past a 32-bit millisecond count is clamped to
// 1ms, so a value meant to mean "effectively never" would fail a healthy run
// instantly.
function backstopSeconds(raw) {
  if (raw === undefined) return 240;
  const parsed = raw.trim() === "" ? Number.NaN : Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2147483) {
    throw new Error(
      `go-wasm-exec.cjs: TTSC_WASM_EXEC_TIMEOUT must be a number of seconds between 0 and 2147483, got ${JSON.stringify(raw)}`,
    );
  }
  return parsed;
}

// describeHandles names what the event loop is still waiting on.
function describeHandles() {
  const handles =
    typeof process._getActiveHandles === "function"
      ? process._getActiveHandles()
      : [];
  const requests =
    typeof process._getActiveRequests === "function"
      ? process._getActiveRequests()
      : [];
  const described = [...handles, ...requests].map((held) => {
    const name = held?.constructor?.name ?? typeof held;
    const detail = [];
    if (typeof held?.fd === "number") detail.push(`fd=${held.fd}`);
    if (typeof held?.writableLength === "number")
      detail.push(`pending=${held.writableLength}`);
    if (typeof held?.bytesWritten === "number")
      detail.push(`written=${held.bytesWritten}`);
    return detail.length === 0 ? name : `${name}(${detail.join(" ")})`;
  });
  const summary =
    typeof process.getActiveResourcesInfo === "function"
      ? process.getActiveResourcesInfo()
      : [];
  // The type summary is kept beside the handles because node reports a pending
  // timer only there, and a wedged runtime holding nothing else is still worth
  // telling apart from one holding a half-written pipe.
  const held = described.length === 0 ? "no handle" : described.join(", ");
  return `${held} (resources: ${summary.join(", ") || "none"})`;
}

process.argv = [
  process.argv[0],
  path.resolve(wasmExec),
  ...process.argv.slice(3),
];
require(process.argv[1]);
