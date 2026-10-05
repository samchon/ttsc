const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Two existing adapter residents retain their own actual lease/fence state.
// The separate seed exits without releasing, establishing the dead-owner edge.
const sessions = new Map();
function operation(input) {
  const { root, api, action } = input;
  const { acquirePluginBuildLock: acquire } = require(path.join(api, "acquirePluginBuildLock.js"));
  const { inspectPluginBuildLock: inspect } = require(path.join(api, "inspectPluginBuildLock.js"));
  const { reclaimPluginBuildLock: reclaim } = require(path.join(api, "reclaimPluginBuildLock.js"));
  const { releasePluginBuildLock: release } = require(path.join(api, "releasePluginBuildLock.js"));
  const lock = path.join(root, "entry.lock");
  let state = sessions.get(root);
  if (!state) { state = { lock, release }; sessions.set(root, state); }
  if (action === "legacy") {
    fs.mkdirSync(lock);
    fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ hostname: os.hostname(), pid: process.pid, startedAt: new Date().toISOString() }));
    state.legacy = inspect(lock);
    return state.legacy;
  }
  if (action === "legacy-release") {
    fs.rmSync(lock, { recursive: true });
    return inspect(lock);
  }
  if (action === "seed") {
    const held = acquire(lock);
    assert.notEqual(held, null);
    return held;
  }
  if (action === "capture") {
    const observed = inspect(lock);
    assert.equal(observed.state, "abandoned");
    state.captured = observed.fence;
    return observed;
  }
  if (action === "reclaim-acquire") {
    assert.ok(state.captured);
    const reclaimed = reclaim(lock, state.captured);
    state.held = acquire(lock);
    return { reclaimed, lease: state.held, current: inspect(lock) };
  }
  if (action === "publish") {
    assert.ok(state.held);
    fs.appendFileSync(path.join(root, "build.log"), "a\n");
    const binary = path.join(root, "plugin.bin");
    fs.writeFileSync(binary + ".tmp", "plugin\n");
    fs.renameSync(binary + ".tmp", binary);
    return { bytes: fs.readFileSync(binary, "utf8"), log: fs.readFileSync(path.join(root, "build.log"), "utf8") };
  }
  if (action === "reuse") return { built: false, bytes: fs.readFileSync(path.join(root, "plugin.bin"), "utf8") };
  if (action === "successor") {
    state.held = acquire(lock);
    assert.notEqual(state.held, null);
    return { lease: state.held, current: inspect(lock) };
  }
  if (action === "finalize") {
    assert.ok(state.held);
    const released = release(lock, state.held);
    state.held = undefined;
    return { released, current: inspect(lock) };
  }
  if (action === "stale-legacy") {
    assert.equal(state.legacy?.state, "active");
    return { reclaimed: reclaim(lock, state.legacy.fence), current: inspect(lock) };
  }
  throw new Error("unknown plugin lock transition " + action);
}
function close() {
  for (const state of sessions.values()) if (state.held) {
    state.release(state.lock, state.held);
    state.held = undefined;
  }
}
module.exports = { operation, close };
if (require.main === module) {
  const [root, api] = process.argv.slice(2);
  process.stdout.write(JSON.stringify(operation({ root, api, action: "seed" })) + "\n");
}
