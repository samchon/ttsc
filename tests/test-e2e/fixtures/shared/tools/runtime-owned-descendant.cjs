module.exports = async function observeOwnedDescendant() {
  const assert = require("node:assert/strict");
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const crypto = require("node:crypto");
  const { spawn } = require("node:child_process");
  const net = require("node:net");
  const { setTimeout: delay } = require("node:timers/promises");
  const root = path.join(__dirname, "runtime-owned-descendant");
  const launcher = process.env.TTSC_E2E_INSTALLED_TTSX;
  const { TtscCompiler } = require(path.join(path.dirname(launcher), "../index.js"));
  const env = { ...process.env };
  for (const name of ["TTSC_CACHE_DIR", "TTSC_GO_CACHE_DIR", "TTSX_RUNTIME_MANIFEST", "TTSX_RUNTIME_RUN_DIR", "TTSX_RUNTIME_CACHE_DIR", "TTSX_RUNTIME_RUNS_DIR"]) delete env[name];
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  const failures = [];
  let ready;
  let parentClosed = false;
  let abandonedLauncher;
  let abandoned;
  let closureUnknown = false;
  let siblingRetirementAttempted = false;
  let siblingRetired = false;

  let cleanResult;
  const nonce = crypto.randomBytes(16).toString("hex");
  // Yielding permits libuv to deliver exit/close and reap direct children.
  const wait = async (predicate) => {
    while (!predicate()) await delay(25);
  };
  const children = new Map();
  const server = net.createServer((socket) => {
    let input = "";
    let announced = false;
    socket.on("error", () => {});
    socket.on("data", (chunk) => {
      if (announced) return;
      input += chunk;
      const end = input.indexOf("\n");
      if (end < 0) return;
      try {
        const row = JSON.parse(input.slice(0, end));
        assert.equal(row.nonce, nonce);
        assert.ok(row.role === "descendant" || row.role === "sibling");
        assert.equal(children.has(row.role), false);
        announced = true;
        children.set(row.role, { socket, row, closed: false });
        socket.once("close", () => { children.get(row.role).closed = true; });
      } catch (error) { failures.push(error); socket.destroy(); }
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const ownedEnv = { ...env, TTSC_E2E_OWNER_PORT: String(server.address().port), TTSC_E2E_OWNER_NONCE: nonce };
  // Register before termination: PID liveness alone cannot acknowledge a direct child's close.
  const launch = (args, options) => {
    const child = spawn(process.execPath, args, options);
    const output = { stdout: "", stderr: "" };
    child.stdout?.on("data", (chunk) => { output.stdout += chunk; });
    child.stderr?.on("data", (chunk) => { output.stderr += chunk; });
    const closed = new Promise((resolve) => {
      child.once("error", (error) => { output.error = error; });
      child.once("close", (status, signal) => resolve({ ...output, status, signal, pid: child.pid }));
    });
    return { child, closed };
  };
  let siblingClosed;
  const running = (pid) => {
    try { process.kill(pid, 0); return true; }
    catch (error) { if (error.code === "ESRCH") return false; throw error; }
  };
  const retireSibling = async () => {
    if (siblingRetired) return;
    if (siblingRetirementAttempted)
      throw new Error("owned runtime sibling closure remained unresolved: earlier retirement failed");
    siblingRetirementAttempted = true;
    // Stop the launcher first so it cannot clean away the abandoned generation.
    if (abandonedLauncher && running(abandonedLauncher.pid)) {
      abandonedLauncher.kill("SIGKILL");
      await siblingClosed;
      await wait(() => !running(abandonedLauncher.pid));
    }
    if (abandoned && running(abandoned.pid)) {
      process.kill(abandoned.pid, "SIGKILL");
      await wait(() => !running(abandoned.pid));
    }
    if (abandonedLauncher && abandoned === undefined)
      throw new Error("owned runtime sibling closure remained unresolved: no authenticated program announcement");
    if (abandonedLauncher) await siblingClosed;
    if (abandoned) await wait(() => children.get("sibling")?.closed === true);
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
    const parent = await launch([launcher, "--cwd", root, "--no-plugins", "src/main.ts"], { cwd: root, env: ownedEnv, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).closed;
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
    await wait(() => children.has("descendant"));
    assert.equal(children.get("descendant").row.pid, ready.pid);
    const cache = fs.realpathSync.native(path.join(root, "node_modules/.cache/ttsc"));
    assert.equal(fs.realpathSync.native(ready.runtime), path.join(cache, "ttsx"));
    assert.equal(fs.realpathSync.native(ready.runs), path.join(cache, "ttsx/project"));
    assert.equal(path.dirname(fs.realpathSync.native(ready.run)), fs.realpathSync.native(ready.runs));
    assert.equal(alive(), true);
    const owners = fs.readdirSync(ready.run).filter((name) => /^owner-.*\.json$/.test(name)).map((name) => JSON.parse(fs.readFileSync(path.join(ready.run, name), "utf8")));
    assert.equal(owners.some((owner) => owner.pid === ready.pid && owner.hostname === os.hostname()), true, "the live descendant must publish its own actual inherited owner record");
    const manifest = fs.readFileSync(ready.manifest);
    // Files retain diagnostics without inherited pipes postponing launcher close
    // until its deliberately orphaned program also exits.
    const siblingStderr = path.join(root, "sibling-" + nonce + ".stderr");
    const descriptor = fs.openSync(siblingStderr, "wx");
    let sibling;
    try {
      sibling = launch([launcher, "--cwd", root, "--no-plugins", "src/abandoned.ts"], {
        cwd: root, env: { ...ownedEnv, TTSC_E2E_ABANDONED_NONCE: nonce },
        stdio: ["ignore", "ignore", descriptor], windowsHide: true,
      });
    } finally { fs.closeSync(descriptor); }
    abandonedLauncher = sibling.child;
    siblingClosed = sibling.closed;
    let siblingTerminal;
    siblingClosed.then((row) => { siblingTerminal = row; });
    assert.ok(abandonedLauncher.pid > 0);
    const announcement = path.join(root, "abandoned-" + nonce + ".json");
    await wait(() => (fs.existsSync(announcement) && children.has("sibling")) || siblingTerminal !== undefined);
    assert.equal(siblingTerminal, undefined, "sibling exited before authenticated readiness: " + JSON.stringify(siblingTerminal) + "\n" + fs.readFileSync(siblingStderr, "utf8"));
    abandoned = JSON.parse(fs.readFileSync(announcement, "utf8"));
    assert.equal(abandoned.nonce, nonce);
    assert.equal(children.get("sibling").row.pid, abandoned.pid);
    assert.ok(abandoned.pid > 0 && abandoned.pid !== ready.pid);
    assert.notEqual(abandoned.run, ready.run);
    assert.equal(path.dirname(fs.realpathSync.native(abandoned.run)), fs.realpathSync.native(ready.runs));
    await retireSibling();
    assert.equal(fs.existsSync(abandoned.run), true, "killed sibling must leave its actual generation for clean");
    assert.equal(alive(), true);
    const cleaned = await launch([path.join(path.dirname(launcher), "ttsc.js"), "clean", "--cwd", root], {
      cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    }).closed;
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
    try { await retireSibling(); } catch (error) {
      closureUnknown = true;
      failures.push(new Error("owned runtime sibling closure remained unresolved", { cause: error }));
    }
    fs.writeFileSync(path.join(root, "release"), "release");
    try {
      await wait(() => !alive());
      if (ready !== undefined) await wait(() => children.get("descendant")?.closed === true);
      if (ready !== undefined) assert.equal(fs.readFileSync(path.join(root, "result"), "utf8"), "owned-descendant-ready");
      if (parentClosed && !closureUnknown) {
        const physicalRuntime = fs.realpathSync.native(path.join(root, "node_modules/.cache/ttsc/ttsx"));
        const removed = new TtscCompiler({ cwd: root, env: { ...env, TTSC_CACHE_DIR: undefined, TTSC_GO_CACHE_DIR: undefined } }).clean();
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
  for (const owned of children.values()) owned.socket.destroy();
  await new Promise((resolve) => server.close(resolve));
  if (failures.length) throw new AggregateError(failures, "owned runtime descendant protection and completed cleanup");
};
