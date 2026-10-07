const fs = require("node:fs");
const path = require("node:path");
fs.writeFileSync(path.join(__dirname, "ready.tmp"), JSON.stringify({ pid: process.pid, manifest: process.env.TTSX_RUNTIME_MANIFEST ?? null, run: process.env.TTSX_RUNTIME_RUN_DIR ?? null, runtime: process.env.TTSX_RUNTIME_CACHE_DIR ?? null, runs: process.env.TTSX_RUNTIME_RUNS_DIR ?? null }));
fs.renameSync(path.join(__dirname, "ready.tmp"), path.join(__dirname, "ready.json"));
const deadline = Date.now() + 30000;
while (!fs.existsSync(path.join(__dirname, "release"))) {
  if (Date.now() > deadline) throw new Error("descendant release was not sent");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}
const { value } = require("../../src/runtime-corpus/descendant-lazy.cts");
fs.writeFileSync(path.join(__dirname, "result"), value);
