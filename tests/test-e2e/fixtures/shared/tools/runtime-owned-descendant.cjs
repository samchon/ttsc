if (!require("node:worker_threads").isMainThread) return;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const root = path.join(__dirname, "runtime-owned-descendant");
const launcher = process.env.TTSC_E2E_INSTALLED_TTSX;
const { TtscCompiler } = require(path.join(path.dirname(launcher), "../index.js"));
const env = { ...process.env };
for (const name of ["TTSC_CACHE_DIR", "TTSX_RUNTIME_MANIFEST", "TTSX_RUNTIME_RUN_DIR", "TTSX_RUNTIME_CACHE_DIR", "TTSX_RUNTIME_RUNS_DIR"]) delete env[name];
fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
const failures = [];
let ready;
let parentClosed = false;
let abandonedLauncher;
let abandoned;
let closureUnknown = false;
let siblingRetirementAttempted = false;
let siblingRetired = false;
let siblingDeadline;
let cleanResult;
const nonce = crypto.randomBytes(16).toString("hex");
const wait = (predicate, message) => {
  const deadline = Math.min(Date.now() + 30000, siblingDeadline ?? Infinity);
  while (!predicate()) {
    assert.ok(Date.now() < deadline, message);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  }
};
const running = (pid) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
};
const retireSibling = () => {
  if (siblingRetired) return;
  if (siblingRetirementAttempted)
    throw new Error("owned runtime sibling closure remained unresolved: earlier retirement failed");
  siblingRetirementAttempted = true;
  // Stop the launcher first so it cannot clean away the abandoned generation.
  if (abandonedLauncher && running(abandonedLauncher.pid)) {
    abandonedLauncher.kill("SIGKILL");
    wait(() => !running(abandonedLauncher.pid), "abandoned launcher closure remained unresolved");
  }
  if (abandoned && running(abandoned.pid)) {
    process.kill(abandoned.pid, "SIGKILL");
    wait(() => !running(abandoned.pid), "abandoned program closure remained unresolved");
  }
  if (abandonedLauncher && abandoned === undefined)
    throw new Error("owned runtime sibling closure remained unresolved: no authenticated program announcement");
  siblingRetired = true;
};
const alive = () => {
  if (ready === undefined) return false;
  try { process.kill(ready.pid, 0); return true; }
  catch (error) {
    if (error.code === "ESRCH") return false;
    throw new Error("owned runtime descendant closure remained unresolved", { cause: error });
  }
};
try {
  const parent = spawnSync(process.execPath, [launcher, "--cwd", root, "--no-plugins", "src/main.ts"], { cwd: root, env, encoding: "utf8", windowsHide: true });
  if (fs.existsSync(path.join(root, "ready.json"))) ready = JSON.parse(fs.readFileSync(path.join(root, "ready.json"), "utf8"));
  if (parent.error || parent.signal !== null || parent.status === null) throw new Error("owned runtime parent closure remained unresolved", { cause: parent.error ?? new Error(JSON.stringify(parent)) });
  parentClosed = true;
  if (ready === undefined) {
    closureUnknown = true;
    throw new Error("owned runtime parent closure remained unresolved: no descendant announcement");
  }
  assert.equal(parent.status, 0, parent.stderr);
  assert.throws(() => process.kill(parent.pid, 0), (error) => error.code === "ESRCH");
  const report = JSON.parse(parent.stdout.trim());
  assert.equal(report.parent > 0, true);
  assert.equal(ready.pid, report.child);
  const cache = fs.realpathSync.native(path.join(root, "node_modules/.cache/ttsc"));
  assert.equal(fs.realpathSync.native(ready.runtime), path.join(cache, "ttsx"));
  assert.equal(fs.realpathSync.native(ready.runs), path.join(cache, "ttsx/project"));
  assert.equal(path.dirname(fs.realpathSync.native(ready.run)), fs.realpathSync.native(ready.runs));
  assert.equal(alive(), true);
  const owners = fs.readdirSync(ready.run).filter((name) => /^owner-.*\.json$/.test(name)).map((name) => JSON.parse(fs.readFileSync(path.join(ready.run, name), "utf8")));
  assert.equal(owners.some((owner) => owner.pid === ready.pid && owner.hostname === os.hostname()), true, "the live descendant must publish its own actual inherited owner record");
  const manifest = fs.readFileSync(ready.manifest);
  siblingDeadline = Date.now() + 90000;
  abandonedLauncher = spawn(process.execPath, [launcher, "--cwd", root, "--no-plugins", "src/abandoned.ts"], {
    cwd: root, env: { ...env, TTSC_E2E_ABANDONED_NONCE: nonce },
    stdio: "ignore", windowsHide: true,
  });
  assert.ok(abandonedLauncher.pid > 0);
  const announcement = path.join(root, "abandoned-" + nonce + ".json");
  wait(() => fs.existsSync(announcement), "abandoned program did not acknowledge its own generation");
  abandoned = JSON.parse(fs.readFileSync(announcement, "utf8"));
  assert.equal(abandoned.nonce, nonce);
  assert.ok(abandoned.pid > 0 && abandoned.pid !== ready.pid);
  assert.notEqual(abandoned.run, ready.run);
  assert.equal(path.dirname(fs.realpathSync.native(abandoned.run)), fs.realpathSync.native(ready.runs));
  retireSibling();
  assert.equal(fs.existsSync(abandoned.run), true, "killed sibling must leave its actual generation for clean");
  assert.equal(alive(), true);
  const cleaned = spawnSync(process.execPath, [path.join(path.dirname(launcher), "ttsc.js"), "clean", "--cwd", root], {
    cwd: root, env, encoding: "utf8", windowsHide: true,
    timeout: Math.max(1, Math.min(30000, siblingDeadline - Date.now())),
  });
  if (cleaned.error || cleaned.signal !== null || cleaned.status === null) {
    closureUnknown = true;
    throw new Error("owned runtime sibling closure remained unresolved: clean launcher", { cause: cleaned.error ?? new Error(JSON.stringify(cleaned)) });
  }
  assert.equal(cleaned.error, undefined);
  assert.equal(cleaned.signal, null);
  assert.equal(cleaned.status, 0, cleaned.stderr);
  cleanResult = cleaned;
  assert.equal(fs.existsSync(abandoned.run), false, cleaned.stdout);
  assert.equal(fs.existsSync(ready.run), true, "default clean must preserve the actual inherited live owner");
  assert.deepEqual(fs.readFileSync(ready.manifest), manifest);
  assert.ok(cleaned.stdout.split(/\r?\n/).includes(
    "ttsc: kept " + path.relative(root, ready.run) + ": a run that may still be in progress owns it",
  ), cleaned.stdout);
} catch (error) { failures.push(error); }
finally {
  fs.writeFileSync(path.join(root, "release-" + nonce), "release");
  try { retireSibling(); } catch (error) {
    closureUnknown = true;
    failures.push(new Error("owned runtime sibling closure remained unresolved", { cause: error }));
  }
  fs.writeFileSync(path.join(root, "release"), "release");
  try {
    const deadline = Date.now() + 30000;
    while (alive()) {
      assert.ok(Date.now() < deadline, "owned runtime descendant closure remained unresolved");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
    if (ready !== undefined) assert.equal(fs.readFileSync(path.join(root, "result"), "utf8"), "owned-descendant-ready");
    if (parentClosed && !closureUnknown) {
      const physicalRuntime = fs.realpathSync.native(path.join(root, "node_modules/.cache/ttsc/ttsx"));
      const removed = new TtscCompiler({ cwd: root, env }).clean();
      assert.ok(removed.some((name) => name === physicalRuntime), JSON.stringify(removed));
      assert.equal(fs.existsSync(path.join(root, "node_modules/.cache/ttsc/ttsx")), false, "default clean must remove the completed inherited generation");
      console.info("TTSC_RUNTIME_CLEAN_OBSERVATION:" + JSON.stringify({
        liveProgram: ready.pid, abandonedLauncher: abandonedLauncher?.pid,
        abandonedProgram: abandoned?.pid, abandonedRun: abandoned?.run,
        keptRun: ready.run, cliStatus: cleanResult?.status,
        cliStdout: cleanResult?.stdout, cliStderr: cleanResult?.stderr,
        removed, physicalRuntime,
      }));
    }
  } catch (error) { failures.push(error); }
}
if (failures.length) throw new AggregateError(failures, "owned runtime descendant protection and completed cleanup");
