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
let response;
let dependencyStatus;
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
  const denied = process.env.TTSC_E2E_READONLY_DENIED === "1";
  const before = fs.readdirSync(directory).sort();
  const cache = process.env.TTSC_CACHE_DIR;
  const nodeOptions = process.env.NODE_OPTIONS;
  const previousDirectory = process.cwd();
  try {
    process.chdir(directory);
    delete process.env.TTSC_CACHE_DIR;
    const defaultStatus = await runTtsx(["--cwd", directory, "--no-plugins", ...(denied ? [] : ["--cache-dir", cache]), "--target", "es2019", "@target-nested.rsp", "src/default.ts"]);
    const excludedStatus = denied ? await runTtsx(["--cwd", directory, "--no-plugins", "--cache-dir", cache, "clear.ts"]) : undefined;
    process.env.NODE_OPTIONS = [nodeOptions, "--import=" + require("node:url").pathToFileURL(path.join(directory, "preload.mjs")).href].filter(Boolean).join(" ");
    let includedStatus;
    try { includedStatus = await runTtsx(["--cwd", directory, "--no-plugins", "--cache-dir", cache, "@target-nested.rsp", "--target", "es2019", "--jsx", "preserve", "@jsx.rsp", "src/main.ts"]); }
    finally {
      if (nodeOptions === undefined) delete process.env.NODE_OPTIONS;
      else process.env.NODE_OPTIONS = nodeOptions;
    }
    const invalidStatus = await runTtsx(["--cwd", directory, "--no-plugins", "--cache-dir", cache, "@target-invalid.rsp", "src/main.ts"]);
    response = { statuses: [defaultStatus, includedStatus, invalidStatus] };
    assert.deepEqual(response.statuses, [0, 0, 2]);
    readonly = denied ? { skipped: false, statuses: [defaultStatus, excludedStatus, includedStatus] } : { skipped: true, statuses: [] };
    if (denied) assert.deepEqual(readonly.statuses, [0, 2, 0]);
    assert.deepEqual(fs.readdirSync(directory).sort(), before, "denied input namespace must not gain a temporary config or output");
  } finally {
    process.chdir(previousDirectory);
    if (nodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = nodeOptions;
    if (cache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = cache;
  }
}).then(async () => {
  const dependencyFiles = ["package.json", "tsconfig.json", "src/dependency-entry.ts"].map((file) => path.join(__dirname, "dependency", file));
  dependencyFiles.push(...["package.json", "tsconfig.json", "banner.config.json", "src/index.ts"].map((file) => path.join(root, "tools/configured-owners/diagnostic", file)));
  const dependencyBytes = dependencyFiles.map((file) => fs.readFileSync(file));
  dependencyStatus = await runTtsx(["--cwd", root, "-P", "tools/runtime-negative/dependency/tsconfig.json", "tools/runtime-negative/dependency/src/dependency-entry.ts"]);
  assert.equal(typeof dependencyStatus, "number");
  assert.notEqual(dependencyStatus, 0, "the imported workspace project's own check must reject before the entry success effect");
  for (let index = 0; index < dependencyFiles.length; index++)
    assert.deepEqual(fs.readFileSync(dependencyFiles[index]), dependencyBytes[index]);
  assert.equal(fs.existsSync(path.join(__dirname, "dependency/dependency-output")), false);
  assert.equal(fs.existsSync(path.join(root, "tools/configured-owners/diagnostic/lib")), false);
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
  assert.equal(typeof dependencyStatus, "number");
  assert.notEqual(dependencyStatus, 0);
  fs.writeFileSync(path.join(__dirname, "observed.json"), JSON.stringify({ statuses: completed, exitCode: process.exitCode, pid: process.pid, readonly, response, dependencyStatus }));
});
