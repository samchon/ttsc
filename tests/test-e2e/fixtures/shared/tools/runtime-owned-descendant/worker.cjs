const fs = require("node:fs");
const path = require("node:path");
fs.writeFileSync(path.join(__dirname, "ready.tmp"), JSON.stringify({ pid: process.pid, manifest: process.env.TTSX_RUNTIME_MANIFEST, run: process.env.TTSX_RUNTIME_RUN_DIR, runtime: process.env.TTSX_RUNTIME_CACHE_DIR, runs: process.env.TTSX_RUNTIME_RUNS_DIR }));
fs.renameSync(path.join(__dirname, "ready.tmp"), path.join(__dirname, "ready.json"));
// The shared owner now prepares and retires one sibling, then invokes the
// public clean launcher before releasing this descendant. The sibling phase
// shares a 90s deadline, followed by the owner's 30s descendant-release wait;
// these are fixture budgets, not guarantees about unbounded native IO.
const deadline = Date.now() + 120000;
while (!fs.existsSync(path.join(__dirname, "release"))) {
  if (Date.now() > deadline) throw new Error("owned descendant release was not sent");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}
fs.writeFileSync(path.join(__dirname, "result"), require("./src/lazy.cts").value);
