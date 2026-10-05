if (!require("node:worker_threads").isMainThread) return;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const { runTtsx } = require(path.join(path.dirname(process.env.TTSC_E2E_INSTALLED_TTSX), "internal/runTtsx.js"));
const signals = ["SIGINT", "SIGTERM", "SIGHUP"];
const listeners = signals.map((signal) => process.listenerCount(signal));
assert.equal(fs.existsSync(path.join(root, "missing-entry.ts")), false);
let completed;
let readonly;
// Both preflight queries stop before compiler or program creation. The real
// installed CLI that follows this preload owns the JavaScript rejection exit.
Promise.all([
  runTtsx(["--cwd", root, "-r"]),
  runTtsx(["--cwd", root, "missing-entry.ts"]),
]).then(async (statuses) => {
  completed = statuses;
  if (process.env.TTSC_E2E_READONLY_ROOT === undefined) {
    readonly = { skipped: true, statuses: [] };
    return;
  }
  const directory = process.env.TTSC_E2E_READONLY_ROOT;
  const before = fs.readdirSync(directory).sort();
  const cache = process.env.TTSC_CACHE_DIR;
  try {
    delete process.env.TTSC_CACHE_DIR;
    const defaultStatus = await runTtsx(["--cwd", directory, "--no-plugins", "src/default.ts"]);
    const excludedStatus = await runTtsx(["--cwd", directory, "--no-plugins", "--cache-dir", cache, "clear.ts"]);
    const includedStatus = await runTtsx(["--cwd", directory, "--no-plugins", "--cache-dir", cache, "src/main.ts"]);
    readonly = { skipped: false, statuses: [defaultStatus, excludedStatus, includedStatus] };
    assert.deepEqual(readonly.statuses, [0, 2, 0]);
    assert.deepEqual(fs.readdirSync(directory).sort(), before, "denied input namespace must not gain a temporary config or output");
  } finally {
    if (cache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = cache;
  }
}).catch((error) => {
  process.stderr.write(String(error) + "\n");
  process.exitCode = 1;
});
process.once("beforeExit", () => {
  assert.deepEqual(completed, [2, 2]);
  assert.equal(process.exitCode, 2, "the actual installed CLI must carry its refusal into the OS exit status");
  assert.deepEqual(signals.map((signal) => process.listenerCount(signal)), listeners, "all dispatcher signal listeners must settle before exit");
  assert.equal(fs.existsSync(path.join(root, "missing-entry.ts")), false);
  assert.ok(readonly, "the owned readonly transition must settle before the actor exits");
  fs.writeFileSync(path.join(__dirname, "observed.json"), JSON.stringify({ statuses: completed, exitCode: process.exitCode, pid: process.pid, readonly }));
});
