const fs = require("node:fs");
const path = require("node:path");
const ready = { pid: process.pid, manifest: process.env.TTSX_RUNTIME_MANIFEST ?? null, run: process.env.TTSX_RUNTIME_RUN_DIR ?? null, runtime: process.env.TTSX_RUNTIME_CACHE_DIR ?? null, runs: process.env.TTSX_RUNTIME_RUNS_DIR ?? null };
require("../runtime-owned-descendant.cjs").connect("registered", ready, () => {
  fs.writeFileSync(path.join(__dirname, "ready.tmp"), JSON.stringify(ready));
  fs.renameSync(path.join(__dirname, "ready.tmp"), path.join(__dirname, "ready.json"));
}, () => {
  const { value } = require("../../src/runtime-corpus/descendant-lazy.cts");
  fs.writeFileSync(path.join(__dirname, "result"), value);
  return value;
});
