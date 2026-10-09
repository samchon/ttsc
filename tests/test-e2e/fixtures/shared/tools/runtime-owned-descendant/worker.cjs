const fs = require("node:fs");
const path = require("node:path");
const ready = { pid: process.pid, manifest: process.env.TTSX_RUNTIME_MANIFEST, run: process.env.TTSX_RUNTIME_RUN_DIR, runtime: process.env.TTSX_RUNTIME_CACHE_DIR, runs: process.env.TTSX_RUNTIME_RUNS_DIR };
require("../runtime-owned-descendant.cjs").connect("descendant", ready, () => {
  fs.writeFileSync(path.join(__dirname, "ready.tmp"), JSON.stringify(ready));
  fs.renameSync(path.join(__dirname, "ready.tmp"), path.join(__dirname, "ready.json"));
}, () => {
  const value = require("./src/lazy.cts").value;
  fs.writeFileSync(path.join(__dirname, "result"), value);
  return value;
});
