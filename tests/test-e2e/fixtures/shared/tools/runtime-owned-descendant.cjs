if (!require("node:worker_threads").isMainThread) return;
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.join(__dirname, "runtime-owned-descendant");
const launcher = process.env.TTSC_E2E_INSTALLED_TTSX;
const { runTtsc } = require(path.join(path.dirname(launcher), "internal/runTtsc.js"));
const env = { ...process.env };
for (const name of ["TTSC_CACHE_DIR", "TTSX_RUNTIME_MANIFEST", "TTSX_RUNTIME_RUN_DIR", "TTSX_RUNTIME_CACHE_DIR", "TTSX_RUNTIME_RUNS_DIR"]) delete env[name];
fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
const failures = [];
let ready;
let parentClosed = false;
const alive = () => {
  if (ready === undefined) return false;
  try { process.kill(ready.pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; throw error; }
};
const clean = () => {
  const previous = process.env.TTSC_CACHE_DIR;
  try { delete process.env.TTSC_CACHE_DIR; return runTtsc(["clean", "--cwd", root]); }
  finally { if (previous === undefined) delete process.env.TTSC_CACHE_DIR; else process.env.TTSC_CACHE_DIR = previous; }
};
try {
  const parent = spawnSync(process.execPath, [launcher, "--cwd", root, "--no-plugins", "src/main.ts"], { cwd: root, env, encoding: "utf8", windowsHide: true });
  if (fs.existsSync(path.join(root, "ready.json"))) ready = JSON.parse(fs.readFileSync(path.join(root, "ready.json"), "utf8"));
  if (parent.error || parent.signal !== null || parent.status === null) throw new Error("owned runtime parent closure remained unresolved", { cause: parent.error ?? new Error(JSON.stringify(parent)) });
  parentClosed = true;
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
  assert.equal(clean(), 0);
  assert.equal(fs.existsSync(ready.run), true, "default clean must preserve the actual inherited live owner");
  assert.deepEqual(fs.readFileSync(ready.manifest), manifest);
} catch (error) { failures.push(error); }
finally {
  fs.writeFileSync(path.join(root, "release"), "release");
  try {
    const deadline = Date.now() + 30000;
    while (alive()) {
      assert.ok(Date.now() < deadline, "owned runtime descendant closure remained unresolved");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
    if (ready !== undefined) assert.equal(fs.readFileSync(path.join(root, "result"), "utf8"), "owned-descendant-ready");
    if (parentClosed) {
      assert.equal(clean(), 0);
      assert.equal(fs.existsSync(path.join(root, "node_modules/.cache/ttsc/ttsx")), false, "default clean must remove the completed inherited generation");
    }
  } catch (error) { failures.push(error); }
}
if (failures.length) throw new AggregateError(failures, "owned runtime descendant protection and completed cleanup");
