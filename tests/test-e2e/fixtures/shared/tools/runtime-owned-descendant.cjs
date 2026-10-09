const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");

// The outer Runtime owns this authenticated rendezvous and original targets.
// These adapters never infer departure from a PID or connection closure.
function beginRequest(role, operation) {
  const root = process.env.TTSC_E2E_DESCENDANT_ROOT;
  const nonce = process.env.TTSC_E2E_DESCENDANT_NONCE;
  if (!root || !nonce) throw new Error("missing Runtime descendant controller");
  const name = crypto.randomUUID() + ".json";
  const file = path.join(root, "requests", name);
  fs.writeFileSync(file + ".pending", JSON.stringify({ nonce, role, operation }));
  fs.renameSync(file + ".pending", file);
  return () => {
    const response = path.join(root, "responses", name);
    if (!fs.existsSync(response)) {
      if (fs.existsSync(path.join(root, "closed.json")))
        throw new Error("Runtime descendant controller closed before response");
      return undefined;
    }
    const row = JSON.parse(fs.readFileSync(response, "utf8"));
    if (row.nonce !== nonce) throw new Error("foreign Runtime descendant response");
    if (Object.hasOwn(row, "error")) throw new Error(row.error);
    return row;
  };
}
function request(role, operation) {
  const read = beginRequest(role, operation);
  for (;;) {
    const row = read();
    if (row) return row.value;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
}
async function requestAsync(role, operation) {
  const read = beginRequest(role, operation);
  for (;;) {
    const row = read();
    if (row) return row.value;
    await delay(10);
  }
}
function connect(role, details, ready, release) {
  const nonce = process.env.TTSC_E2E_DESCENDANT_NONCE;
  const socket = require("node:net").connect(Number(process.env.TTSC_E2E_DESCENDANT_PORT), "127.0.0.1");
  let input = "";
  let phase = "announcing";
  const frame = (data) => ({ version: 1, nonce, role, pid: process.pid, ...data });
  const fail = (error) => {
    const root = process.env.TTSC_E2E_DESCENDANT_ROOT;
    if (root) fs.writeFileSync(path.join(root, role + "-error.json"), JSON.stringify({ nonce, pid: process.pid, error: String(error) }));
    process.exit(1);
  };
  socket.on("error", fail);
  socket.on("end", () => { if (phase !== "completed") fail(new Error("controller ended before completion")); });
  socket.on("connect", () => socket.write(JSON.stringify(frame({ event: "announce", parentPid: process.ppid, ...details })) + "\n"));
  socket.on("data", (chunk) => {
    try {
      input += chunk.toString("utf8");
        if (Buffer.byteLength(input) > 65536) throw new Error("controller frame exceeds 64KiB");
      let end;
      while ((end = input.indexOf("\n")) >= 0) {
        const row = JSON.parse(input.slice(0, end));
        input = input.slice(end + 1);
        if (row.version !== 1 || row.nonce !== nonce || row.role !== role)
          throw new Error("foreign controller command");
        if (row.event === "acquired") {
          if (phase !== "announcing" || row.target.pid !== process.pid || row.parent.pid !== process.ppid)
            throw new Error("invalid original-target acquisition");
          phase = "held";
          ready(row);
          continue;
        }
        if (row.event !== "command" || phase !== "held") throw new Error("invalid descendant command phase");
        phase = "released";
        if (row.operation === "abandon" || row.operation === "abort") {
          // Self-selection cannot race an externally reused numeric PID. This
          // abrupt path deliberately runs no launcher or program cleanup.
          fs.writeFileSync(path.join(process.env.TTSC_E2E_DESCENDANT_ROOT, role + "-abandon.json"), JSON.stringify(frame({ operation: row.operation })));
          process.kill(process.pid, "SIGKILL");
          throw new Error("self SIGKILL unexpectedly returned");
        }
        if (row.operation !== "release") throw new Error("unknown descendant command");
        let completion;
        try { completion = { value: release() }; }
        catch (error) { completion = { error: { message: String(error), stack: error?.stack } }; process.exitCode = 1; }
        phase = "completed";
        socket.end(JSON.stringify(frame({ event: "complete", completedAt: new Date().toISOString(), ...completion })) + "\n");
      }
    } catch (error) { fail(error); }
  });
}

function publishOutcome(name, facts) {
  if (name !== "owned" && name !== "declared" && name !== "clean") throw new Error("unknown runtime actor receipt");
  const directory = process.env.TTSC_E2E_DESCENDANT_ROOT;
  const nonce = process.env.TTSC_E2E_DESCENDANT_NONCE;
  if (!directory || !nonce) throw new Error("missing runtime actor receipt owner");
  const file = path.join(directory, name + "-outcome.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify({ ...facts, nonce, owner: process.pid }));
  fs.renameSync(file + ".tmp", file);
}

module.exports = async function observeOwnedDescendant() {
  const assert = require("node:assert/strict");
  const os = require("node:os");
  const { spawn } = require("node:child_process");
  const root = path.join(__dirname, "runtime-owned-descendant");
  const launcher = process.env.TTSC_E2E_INSTALLED_TTSX;
  const { TtscCompiler } = require(path.join(path.dirname(launcher), "../index.js"));
  const env = { ...process.env };
  for (const name of ["TTSC_CACHE_DIR", "TTSC_GO_CACHE_DIR", "TTSX_RUNTIME_MANIFEST", "TTSX_RUNTIME_RUN_DIR", "TTSX_RUNTIME_CACHE_DIR", "TTSX_RUNTIME_RUNS_DIR"]) delete env[name];
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  const failures = [];
  let ready;
  let parentClosed = false;
  let sibling;
  let abandoned;
  let siblingRetired = false;
  let siblingAbandonPrepared = false;
  let siblingAbandoned = false;
  let descendantRetired = false;
  let cleanResult;
  let descendantInput;
  let siblingInput;
  const facts = { finished: false, actors: {}, semanticErrors: [] };
  const save = () => {
    try { publishOutcome("owned", facts); }
    catch (cause) { failures.push(new Error("owned runtime actor receipt failed", { cause })); }
  };
  save();
  const traceRoot = process.env.TTSC_E2E_TRACE;
  assert.ok(traceRoot && path.isAbsolute(traceRoot), "Runtime must provide its internal cleanup trace even without external diagnostics");
  const traceCursor = () => Object.fromEntries(fs.readdirSync(traceRoot)
    .filter((name) => /^\d+-[a-f0-9]{32}\.jsonl$/.test(name))
    .map((name) => [name, fs.statSync(path.join(traceRoot, name)).size]));
  // Consume only this actual process's new, complete writer frames. The API
  // cursor excludes earlier calls in the same long-lived preload actor.
  const traceRows = (name, pid, cursor, argv, cwd) => {
    const tails = fs.readdirSync(traceRoot).filter((file) => file.startsWith(pid + "-") && /^\d+-[a-f0-9]{32}\.jsonl$/.test(file)).map((file) => {
      const bytes = fs.readFileSync(path.join(traceRoot, file));
      const offset = cursor[file] ?? 0;
      assert.ok(offset <= bytes.length, "cleanup writer cannot truncate its admitted prefix");
      assert.ok(offset === 0 || bytes[offset - 1] === 10, "cleanup cursor must end at a complete frame");
      return { file, prefix: bytes.subarray(0, offset).toString("utf8"), text: bytes.subarray(offset).toString("utf8") };
    }).filter((tail) => tail.text.length !== 0);
    (facts.traces ??= {})[name] = { pid, argv, cwd, cursor, tails };
    save();
    assert.equal(tails.length, 1, "one actual cleanup writer must supply fresh evidence");
    const tail = tails[0];
    assert.ok(tail.text.endsWith("\n"), "cleanup trace must end in a complete frame");
    const instance = tail.file.slice(String(pid).length + 1, -6);
    let sequence = tail.prefix ? JSON.parse(tail.prefix.trimEnd().split("\n").at(-1)).sequence : 0;
    const rows = tail.text.trimEnd().split("\n").map((line) => JSON.parse(line));
    for (const row of rows) {
      assert.equal(row.schema, 1);
      assert.equal(row.writerPid, pid);
      assert.equal(row.instance, instance);
      assert.equal(row.sequence, ++sequence);
      assert.ok(typeof row.invocation === "string" && row.invocation.startsWith(instance + ":"));
      assert.notEqual(row.event, "integrity-failure");
      if (row.event === "runtime-cleanup") {
        assert.equal(row.pid, pid);
        assert.deepEqual(row.argv, argv);
        assert.equal(row.cwd, cwd);
      }
    }
    return rows;
  };
  const runFiles = (directory) => {
    const files = {};
    const visit = (folder) => {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        const file = path.join(folder, entry.name);
        const relative = path.relative(directory, file);
        if (entry.isSymbolicLink()) files[relative] = { link: fs.readlinkSync(file) };
        else if (entry.isDirectory()) { files[relative] = { directory: true }; visit(file); }
        else { assert.equal(entry.isFile(), true); files[relative] = { bytes: fs.readFileSync(file).toString("base64") }; }
      }
    };
    visit(directory);
    return files;
  };
  const runInput = (announcement, ownerPids) => {
    const directory = fs.realpathSync.native(announcement.run);
    const runtime = fs.realpathSync.native(ready.runtime);
    assert.equal(path.dirname(directory), fs.realpathSync.native(ready.runs));
    const files = runFiles(directory);
    const owners = Object.entries(files).filter(([name]) => /^owner-.*\.json$/.test(name)).map(([record, file]) => {
      assert.equal(typeof file.bytes, "string");
      const owner = JSON.parse(Buffer.from(file.bytes, "base64").toString("utf8"));
      assert.ok(Number.isSafeInteger(owner.pid) && owner.pid > 0);
      assert.equal(owner.hostname, os.hostname());
      assert.equal(record, "owner-" + owner.pid + ".json");
      return { record, owner };
    });
    assert.deepEqual(owners.map(({ owner }) => owner.pid).sort((a, b) => a - b), [...new Set(ownerPids)].sort((a, b) => a - b), "persisted owners must match this phase's independently launched/admitted processes");
    return { directory, runtime, owners, files };
  };
  const rawProtection = (observed, input) => {
    assert.ok(observed.length > 0);
    const seen = new Set();
    let protectedOwner = false;
    for (const row of observed) {
      assert.equal(row.data.phase, "owner-observation");
      assert.equal(protectedOwner, false, "a native protective observation terminates the actual owner scan");
      const observation = row.data.ownerObservation;
      const expected = input.owners.find(({ record }) => record === observation.record);
      assert.ok(expected, "raw probe must name an independently captured owner");
      assert.equal(seen.has(observation.record), false);
      seen.add(observation.record);
      assert.deepEqual(observation.owner, expected.owner);
      if (observation.result === "absent") assert.equal(observation.errorCode, "ESRCH");
      else if (observation.result === "present") {
        assert.equal(observation.errorCode, undefined);
        protectedOwner = true;
      } else if (observation.result === "unknown") {
        assert.ok(observation.errorCode === undefined || typeof observation.errorCode === "string");
        assert.notEqual(observation.errorCode, "ESRCH");
        protectedOwner = true;
      } else assert.fail("local authenticated owner has an invalid raw probe result");
    }
    if (!protectedOwner) assert.equal(seen.size, input.owners.length, "absence requires every independently recorded owner");
    return protectedOwner;
  };
  const scanClean = (name, rows, inputs) => {
    const selected = rows.filter((row) => row.event === "runtime-cleanup");
    assert.ok(selected.length > 0);
    const groups = new Map();
    for (const row of selected) {
      assert.equal(row.data.origin, "runtime-clean-selection");
      const group = groups.get(row.invocation) ?? [];
      group.push(row);
      groups.set(row.invocation, group);
    }
    assert.equal(groups.size, inputs.length, "each actual generation needs its own fresh selection invocation");
    const scans = [];
    for (const input of inputs) {
      const matches = [...groups.values()].filter((group) => group[0].data.directory === input.directory);
      assert.equal(matches.length, 1, "cleanup invocation must select the independently pinned generation");
      const group = matches[0];
      for (const row of group) {
        assert.equal(row.data.directory, input.directory);
        assert.equal(row.data.runtimeCacheDir, input.runtime);
      }
      assert.equal(group[0].data.phase, "attempt");
      assert.equal(group[1]?.data.phase, "selection-started");
      const protectedOwner = rawProtection(group.slice(2, -2), input);
      const ownership = protectedOwner ? "live" : "abandoned";
      assert.equal(group.at(-2).data.phase, "ownership");
      assert.equal(group.at(-2).data.ownership, ownership);
      assert.equal(group.at(-1).data.phase, protectedOwner ? "retention-selected" : "removal-selected");
      assert.equal(group.at(-1).data.ownership, ownership);
      scans.push({ directory: input.directory, runtime: input.runtime, owners: input.owners, protected: protectedOwner, rows: group });
    }
    (facts.cleanupScans ??= {})[name] = scans;
    save();
    return scans;
  };
  const assertCleanFiles = (scans, inputs, removed, stdout) => {
    for (const [index, scan] of scans.entries()) {
      if (scan.protected) {
        assert.deepEqual(runFiles(scan.directory), inputs[index].files, "conservative clean must preserve exact protected generation bytes");
        if (stdout !== undefined) assert.ok(stdout.split(/\r?\n/).includes("ttsc: kept " + path.relative(root, scan.directory) + ": a run that may still be in progress owns it"), stdout);
        if (removed) for (const target of removed) {
          const relative = path.relative(target, scan.directory);
          assert.ok(relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative), "API cannot remove a protected run or its ancestor");
        }
      } else {
        assert.equal(fs.existsSync(scan.directory), false, "all-ESRCH generation must actually be removed");
        if (stdout !== undefined) assert.ok(stdout.split(/\r?\n/).includes("ttsc: removed " + path.relative(root, scan.directory)), stdout);
        if (removed) assert.ok(removed.includes(scan.directory), JSON.stringify(removed));
      }
    }
    const retained = scans.some((scan) => scan.protected);
    assert.equal(fs.existsSync(scans[0].runtime), retained);
    if (removed) assert.equal(removed.includes(scans[0].runtime), !retained);
  };
  const nonce = crypto.randomBytes(16).toString("hex");
  const launch = (name, args, options) => {
    facts.actors[name] = { attempted: true, closed: false, at: new Date().toISOString() };
    save();
    const child = spawn(process.execPath, args, options);
    facts.actors[name].pid = child.pid;
    save();
    const output = { stdout: "", stderr: "" };
    child.stdout?.on("data", (chunk) => { output.stdout += chunk; });
    child.stderr?.on("data", (chunk) => { output.stderr += chunk; });
    const closed = new Promise((resolve) => {
      child.once("error", (error) => { output.error = error; });
      child.once("close", (status, signal) => {
        Object.assign(facts.actors[name], { closed: true, status, signal, error: output.error ? String(output.error) : null, closedAt: new Date().toISOString() });
        save();
        resolve({ ...output, status, signal, pid: child.pid });
      });
    });
    return { child, closed };
  };
  const retireSibling = async () => {
    if (siblingRetired || !sibling) return;
    if (!abandoned) throw new Error("owned runtime sibling closure remained unresolved: no authenticated admission");
    if (!siblingAbandonPrepared) {
      // A nondetached program can retire with its direct launcher on Windows.
      // Declare the actual abrupt operation while both originals are held,
      // before causing that termination rather than forgiving it afterwards.
      facts.siblingAbandonPrepared = await requestAsync("sibling", "prepare-abandon");
      save();
      siblingAbandonPrepared = true;
    }
    // The actual direct launcher must retire before its program is killed,
    // otherwise normal launcher cleanup can remove the abandoned generation.
    if (sibling.child.exitCode === null && sibling.child.signalCode === null) {
      facts.actors.sibling.killRequestedAt = new Date().toISOString();
      save();
      facts.actors.sibling.killAccepted = sibling.child.kill("SIGKILL");
      save();
    }
    // Kernel parent retirement precedes any self-kill of a surviving sibling.
    // An already-retired original needs no command. Output/close drains after
    // child departure so inherited handles cannot make a circular gate.
    facts.siblingParentJoin = await requestAsync("sibling", "parent-joined");
    save();
    if (!siblingAbandoned) {
      facts.siblingAbandon = await requestAsync("sibling", "abandon");
      save();
      siblingAbandoned = true;
    }
    facts.siblingJoin = await requestAsync("sibling", "joined");
    save();
    await sibling.closed;
    siblingRetired = true;
  };
  try {
    const parentArgs = [launcher, "--cwd", root, "--no-plugins", "src/main.ts"];
    const parentCursor = traceCursor();
    const parent = await launch("parent", parentArgs, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).closed;
    if (parent.error || parent.signal !== null || parent.status === null) throw new Error("owned runtime parent closure remained unresolved", { cause: parent.error ?? new Error(JSON.stringify(parent)) });
    parentClosed = true;
    assert.equal(parent.status, 0, parent.stderr);
    const admission = await requestAsync("descendant", "ready");
    facts.descendantAdmission = admission;
    save();
    ready = admission.announcement;
    await requestAsync("descendant", "parent-joined");
    const report = JSON.parse(parent.stdout.trim());
    assert.equal(report.parent, admission.parent.pid);
    assert.equal(ready.pid, report.child);
    const cache = fs.realpathSync.native(path.join(root, "node_modules/.cache/ttsc"));
    assert.equal(fs.realpathSync.native(ready.runtime), path.join(cache, "ttsx"));
    assert.equal(fs.realpathSync.native(ready.runs), path.join(cache, "ttsx/project"));
    assert.equal(path.dirname(fs.realpathSync.native(ready.run)), fs.realpathSync.native(ready.runs));
    await requestAsync("descendant", "live");
    // The normal launcher relinquishes its initial claim. The actual executed
    // program and inherited worker retain their separately admitted records.
    descendantInput = runInput(ready, [admission.parent.pid, admission.target.pid]);
    const parentRows = traceRows("parent", parent.pid, parentCursor, [process.execPath, ...parentArgs], root)
      .filter((row) => row.event === "runtime-cleanup");
    assert.ok(parentRows.length >= 6);
    for (const row of parentRows) {
      assert.equal(row.invocation, parentRows[0].invocation);
      assert.equal(row.data.origin, "ttsx-runtime-cleanup");
      assert.equal(row.data.directory, descendantInput.directory);
      assert.equal(row.data.runtimeCacheDir, descendantInput.runtime);
    }
    assert.deepEqual(parentRows.slice(0, 2).map((row) => row.data.phase), ["attempt", "lock-entered"]);
    assert.deepEqual(parentRows.slice(-3).map((row) => row.data.phase), ["ownership", "retained", "completed"]);
    assert.equal(parentRows.at(-3).data.ownership, "live");
    assert.equal(parentRows.at(-2).data.ownership, "live");
    assert.equal(rawProtection(parentRows.slice(2, -3), descendantInput), true);
    const manifest = fs.readFileSync(ready.manifest);
    const siblingStderr = path.join(root, "sibling-" + nonce + ".stderr");
    const descriptor = fs.openSync(siblingStderr, "wx");
    try {
      sibling = launch("sibling", [launcher, "--cwd", root, "--no-plugins", "src/abandoned.ts"], {
        cwd: root, env: { ...env, TTSC_E2E_ABANDONED_NONCE: nonce },
        stdio: ["ignore", "ignore", descriptor], windowsHide: true,
      });
    } finally { fs.closeSync(descriptor); }
    let siblingTerminal;
    void sibling.closed.then((row) => { siblingTerminal = row; });
    const announcement = path.join(root, "abandoned-" + nonce + ".json");
    while (!fs.existsSync(announcement)) {
      if (siblingTerminal) throw new Error("sibling exited before authenticated readiness: " + JSON.stringify(siblingTerminal) + "\n" + fs.readFileSync(siblingStderr, "utf8"));
      await delay(10);
    }
    const siblingAdmission = await requestAsync("sibling", "ready");
    facts.siblingAdmission = siblingAdmission;
    save();
    abandoned = siblingAdmission.announcement;
    assert.equal(abandoned.parentPid, sibling.child.pid);
    assert.equal(abandoned.abandonedNonce, nonce);
    assert.ok(abandoned.pid > 0 && abandoned.pid !== ready.pid);
    assert.notEqual(abandoned.run, ready.run);
    assert.equal(path.dirname(fs.realpathSync.native(abandoned.run)), fs.realpathSync.native(ready.runs));
    siblingInput = runInput(abandoned, [sibling.child.pid, siblingAdmission.target.pid]);
    await retireSibling();
    assert.equal(fs.existsSync(abandoned.run), true, "killed sibling must leave its actual generation for clean");
    assert.deepEqual(runFiles(siblingInput.directory), siblingInput.files, "abrupt retirement must leave the actual pre-kill generation unchanged");
    await requestAsync("descendant", "live");
    const cliInputs = [siblingInput, runInput(ready, [admission.parent.pid, admission.target.pid])];
    assert.deepEqual(fs.readdirSync(ready.runs).sort(), cliInputs.map((input) => path.basename(input.directory)).sort());
    const cleanArgs = [path.join(path.dirname(launcher), "ttsc.js"), "clean", "--cwd", root];
    const cliCursor = traceCursor();
    const cleaned = await launch("clean", cleanArgs, {
      cwd: root, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    }).closed;
    facts.cliClean = { pid: cleaned.pid, status: cleaned.status, signal: cleaned.signal, stdout: cleaned.stdout, stderr: cleaned.stderr };
    save();
    if (cleaned.error || cleaned.signal !== null || cleaned.status === null) throw new Error("owned runtime sibling closure remained unresolved: clean launcher", { cause: cleaned.error ?? new Error(JSON.stringify(cleaned)) });
    assert.equal(cleaned.status, 0, cleaned.stderr);
    cleanResult = cleaned;
    const cliScans = scanClean("cli", traceRows("cli", cleaned.pid, cliCursor, [process.execPath, ...cleanArgs], root), cliInputs);
    assertCleanFiles(cliScans, cliInputs, undefined, cleaned.stdout);
    assert.equal(cliScans[1].protected, true, "the independently held descendant must protect its generation");
    assert.equal(fs.existsSync(ready.run), true, "default clean must preserve the actual inherited live owner");
    assert.deepEqual(fs.readFileSync(ready.manifest), manifest);
    assert.ok(cleaned.stdout.split(/\r?\n/).includes("ttsc: kept " + path.relative(root, ready.run) + ": a run that may still be in progress owns it"), cleaned.stdout);
  } catch (error) { failures.push(error); }
  finally {
    try { await retireSibling(); }
    catch (error) { failures.push(new Error("owned runtime sibling closure remained unresolved", { cause: error })); }
    try {
      if (!ready) {
        const admission = await requestAsync("descendant", "ready");
        facts.descendantAdmission = admission;
        ready = admission.announcement;
        save();
      }
      await requestAsync("descendant", "release");
      const joined = await requestAsync("descendant", "joined");
      facts.descendantJoin = joined;
      save();
      descendantRetired = joined.retired;
      assert.equal(joined.completion.value, "owned-descendant-ready");
      assert.equal(fs.readFileSync(path.join(root, "result"), "utf8"), "owned-descendant-ready");
      if (parentClosed && descendantRetired && (!sibling || siblingRetired)) {
        const physicalRuntime = fs.realpathSync.native(path.join(root, "node_modules/.cache/ttsc/ttsx"));
        const admission = facts.descendantAdmission;
        const apiInputs = [runInput(ready, [admission.parent.pid, admission.target.pid])];
        if (abandoned && fs.existsSync(abandoned.run)) {
          assert.ok(siblingInput, "retained abandoned generation must have its pre-kill identity");
          assert.deepEqual(runFiles(siblingInput.directory), siblingInput.files);
          apiInputs.push(siblingInput);
        }
        assert.deepEqual(fs.readdirSync(ready.runs).sort(), apiInputs.map((input) => path.basename(input.directory)).sort());
        const apiCursor = traceCursor();
        const removed = new TtscCompiler({ cwd: root, env: { ...env, TTSC_CACHE_DIR: undefined, TTSC_GO_CACHE_DIR: undefined } }).clean();
        facts.apiClean = { removed, physicalRuntime };
        save();
        const apiScans = scanClean("api", traceRows("api", process.pid, apiCursor, process.argv, process.cwd()), apiInputs);
        assertCleanFiles(apiScans, apiInputs, removed);
        console.info("TTSC_RUNTIME_CLEAN_OBSERVATION:" + JSON.stringify({ liveProgram: ready.pid, abandonedLauncher: sibling?.child.pid, abandonedProgram: abandoned?.pid, abandonedRun: abandoned?.run, keptRun: ready.run, cliStatus: cleanResult?.status, cliStdout: cleanResult?.stdout, cliStderr: cleanResult?.stderr, removed, physicalRuntime }));
      }
    } catch (error) { failures.push(new Error("owned runtime descendant closure remained unresolved", { cause: error })); }
  }
  facts.finished = true;
  facts.semanticErrors = failures.map(String);
  save();
  if (failures.length) throw new AggregateError(failures, "owned runtime descendant protection and completed cleanup");
};
module.exports.request = request;
module.exports.requestAsync = requestAsync;
module.exports.connect = connect;
module.exports.publishOutcome = publishOutcome;
