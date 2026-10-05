// Inherited preloads must not clean the main Runtime consumer's resources.
if (!require("node:worker_threads").isMainThread) return;

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

// These are the installed CLI's production dispatch and lock operations. The
// existing runtime owns their real filesystem/status/stdio effects; no clean
// launcher or new consumer project is prepared for either command.
const launcher = path.dirname(process.env.TTSC_E2E_INSTALLED_TTSX);
const { runTtsc } = require(path.join(launcher, "internal/runTtsc.js"));
const { resolveSourceBuildCachePaths } = require(path.join(launcher, "../plugin/internal/source/resolveSourceBuildCachePaths.js"));
const root = path.join(__dirname, "runtime-clean-flow");
const cache = path.join(root, "node_modules/.cache/ttsc");
const runtime = path.join(cache, "ttsx");
const runs = path.join(runtime, "project");
const home = path.join(root, "clean-process-home");
const temporary = path.join(home, "tmp");
const registerMarker = path.join(root, "executed.txt");
const registerDiagnostics = path.join(root, "register-diagnostics.json");
const registerSource = path.join(root, "src/main.ts");
const registerSourceBytes = fs.readFileSync(registerSource);
const environment = {
  HOME: home, USERPROFILE: home, LOCALAPPDATA: path.join(home, "AppData/Local"),
  XDG_CACHE_HOME: path.join(home, "xdg"), TMPDIR: temporary, TEMP: temporary, TMP: temporary,
  TTSC_CACHE_DIR: "", TTSC_GO_CACHE_DIR: "", GOCACHE: "",
};
const previous = Object.fromEntries(Object.keys(environment).map((name) => [name, process.env[name]]));
assert.equal(fs.existsSync(cache), false);
fs.mkdirSync(temporary, { recursive: true });
fs.mkdirSync(path.join(root, "node_modules"));
try {
  Object.assign(process.env, environment);
  assert.equal(resolveSourceBuildCachePaths(fs.realpathSync.native(root), undefined, {}).root,
    path.join(fs.realpathSync.native(root), "node_modules/.cache/ttsc"), "the declared workspace keeps this cleanup in its own native boundary");
  fs.mkdirSync(runtime, { recursive: true });
  const lockDirectory = fs.realpathSync.native(runtime) + ".lock";
  const { RuntimeManifestRegistry } = require(path.join(launcher, "internal/runtime/RuntimeManifestRegistry.js"));
  const missingSource = fs.realpathSync.native(path.join(__dirname, "../src/runtime-corpus/owned-lazy.cts"));
  const owned = RuntimeManifestRegistry.findEntryEmit(missingSource);
  assert.ok(owned, "the shared prepared Program must own the lazy module's actual output");
  const ownedBytes = fs.readFileSync(owned.emittedFile);
  let seed;
  try {
    fs.unlinkSync(owned.emittedFile);
    seed = spawnSync(process.execPath, [path.join(__dirname, "runtime-lock-seed.cjs")], {
      cwd: root, encoding: "utf8", windowsHide: true,
      env: { ...process.env, TTSC_E2E_LOCK_DIRECTORY: lockDirectory,
        TTSC_E2E_REGISTER_IMPLEMENTATION: path.join(launcher, "../register.js"),
        TTSC_E2E_REGISTER_MARKER: registerMarker,
        TTSC_E2E_REGISTER_DIAGNOSTICS: registerDiagnostics,
        TTSC_E2E_MISSING_OWNED_SOURCE: missingSource,
        TTSC_E2E_LOCK_IMPLEMENTATION: path.join(launcher, "internal/runtime/acquireDependencyBuildLock.js") },
    });
  } finally {
    fs.writeFileSync(owned.emittedFile, ownedBytes);
  }
  assert.equal(seed.error, undefined);
  assert.equal(seed.signal, null);
  assert.equal(seed.status, 1, seed.stderr);
  assert.equal(seed.stdout.trim(), "FIRST\nholder-acquired");
  assert.deepEqual(JSON.parse(fs.readFileSync(registerDiagnostics, "utf8")), {
    includedRejected: true, firstExecuted: true, excludedRejected: true, markersAbsent: true,
  });
  assert.equal(fs.existsSync(registerMarker), false);
  assert.deepEqual(fs.readFileSync(registerSource), registerSourceBytes);
  assert.match(seed.stderr, /the JavaScript emitted for .*owned-lazy\.cts is missing: .*owned-lazy\.cjs/);
  assert.doesNotMatch(seed.stdout, /lazy ran/);
  assert.equal(typeof seed.pid, "number");
  assert.ok(seed.pid > 0);
  assert.throws(() => process.kill(seed.pid, 0), (error) => error.code === "ESRCH", "an actual exited holder must be distinguished from a live or reused PID");
  assert.equal(runTtsc(["clean", "--cwd", root]), 0);
  const deadHolderRecovered = !fs.existsSync(runtime);
  assert.equal(deadHolderRecovered, true, "default clean recovers the actual exited holder");

  const legacy = path.join(runs, "legacy");
  const unknown = path.join(runs, "unknown");
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, "main.js"), "");
  fs.mkdirSync(unknown);
  fs.writeFileSync(path.join(unknown, "owner-12.json"), "{");
  console.info("TTSC_CLEAN_PHASE:legacy:begin");
  const defaultStatus = runTtsc(["clean", "--cwd", root]);
  console.info("TTSC_CLEAN_PHASE:legacy:end");
  assert.equal(defaultStatus, 0);
  const legacyKept = fs.existsSync(legacy);
  const malformedKept = fs.existsSync(unknown);
  assert.equal(legacyKept, true);
  assert.equal(malformedKept, true);
  const explicitStatus = runTtsc(["clean", "--cwd", root, "--cache-dir", cache]);
  assert.equal(explicitStatus, 0);
  const legacyRemoved = !fs.existsSync(legacy);
  const malformedRemoved = !fs.existsSync(unknown);
  assert.equal(legacyRemoved, true);
  assert.equal(malformedRemoved, true);
  fs.writeFileSync(path.join(root, "observed.json"), JSON.stringify({
    defaultStatus, explicitStatus, deadHolderRecovered, legacyKept, malformedKept,
    explicitRemoved: legacyRemoved && malformedRemoved, seed: { pid: seed.pid, status: seed.status, signal: seed.signal, missingOwned: true },
  }));
} finally {
  for (const name of Object.keys(environment)) {
    if (previous[name] === undefined) delete process.env[name];
    else process.env[name] = previous[name];
  }
}
