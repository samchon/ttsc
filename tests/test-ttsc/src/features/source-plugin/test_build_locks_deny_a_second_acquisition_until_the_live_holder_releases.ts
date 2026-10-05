import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { acquireDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/acquireDependencyBuildLock";
import { releaseDependencyBuildLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/releaseDependencyBuildLock";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { inspectPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/inspectPluginBuildLock";
import { reclaimPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/reclaimPluginBuildLock";
import type { PluginBuildLockLease } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockLease";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";

/**
 * Verifies lock admission: a live generation denies a second acquisition until its real owner releases.
 * A shared plugin-only actor DAG follows the sequential controls: A removes
 * its real legacy path, an exited seed leaves v3, A/B capture that dead fence,
 * and B survives A's late finalizer before releasing. Portable errno classification is covered directly in the source unit
 * test_contended_candidate_rename_classifies_only_protocol_collision_errors.
 *
 * 1. Acquire each protocol's lease and assert a second acquisition is denied.
 * 2. Release each holder in finally.
 * 3. Assert each protocol admits a new lease and release those controls.
 * 4. Retire a plugin generation, then reject its stale release/reclaim and a vanished legacy fence while a successor remains active.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual plugin and dependency lock admission deny occupied current and admit released current. Sequential plugin controls distinguish stale release/reclaim and legacy namespace separation. The plugin-only actor DAG additionally observes a real departed seed, two equal abandoned fences, A winning while B cannot reclaim/acquire, one literal artifact publication reused by B, parent retirement of live A, false delayed A release, stale legacy reclaim false while B's exact fence remains active, true B release and seed/A/B tombstones.
 * @evidence contracts/testing.md#independent-expectations Real acquired leases and literal retirement/fence/released/tombstone expectations distinguish ownership from pathname reuse. Real status0/signalnull/positive PID and ESRCH-only probing independently establish seed absence, subject to PID reuse preparation failure. File gates order actual actor operations; exact one-line build log and plugin newline bytes distinguish one publication/reuse from two. Legacy owner records use the actual acquiring process; no filesystem errors are injected.
 * @evidence contracts/testing.md#distinguishing-cases Both protocols have same-process occupied/released controls. Plugin-only sequential rows isolate token and namespace policy; the shared actor DAG adds departed seed and two independently captured stale fences, active successor denial, literal artifact reuse, live late finalizer and normal successor close. Legacy A removes its path normally before seed/v3 acquisition; it remains alive through the delayed finalizer. This combines three original coordination meanings without three independent worker preparations, and does not exercise Go compilation or SDK publication. The source classifier unit separately owns errno distinctions.
 * @evidence contracts/testing.md#execution-ownership Initial same-process plugin/dependency admission and fencing rows call actual source owners. One additional plugin-only DAG uses the existing unit source loader in three Node workers: an exited seed and two live observers, with A also owning the preceding legacy path. There is no Go/compiler/SDK/installed host. Real gates, ESRCH-only seed absence and actual close outcomes own coordination; private artifact bytes are publication inputs, not compiled binaries. Finally opens every gate and joins all workers before cleanup, retaining inputs after unknown completion. Timeouts request termination without descendant proof; captured output is not byte-bounded. Authored coverage is unexecuted until the unit runner runs it.
 */
export async function test_build_locks_deny_a_second_acquisition_until_the_live_holder_releases(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-lock-contended-rename-");
  const pluginLock = path.join(root, "plugin.lock");
  const dependencyLock = path.join(root, "dependency.lock");
  const pluginHolder = acquirePluginBuildLock(pluginLock);
  let dependencyHolder: ReturnType<typeof acquireDependencyBuildLock> = null;
  try {
    assert.notEqual(pluginHolder, null);
    dependencyHolder = acquireDependencyBuildLock(dependencyLock);
    assert.notEqual(dependencyHolder, null);
    assert.equal(acquirePluginBuildLock(pluginLock), null);
    assert.equal(acquireDependencyBuildLock(dependencyLock), null);
  } finally {
    try {
      if (pluginHolder !== null) releasePluginBuildLock(pluginLock, pluginHolder);
    } finally {
      if (dependencyHolder !== null) releaseDependencyBuildLock(dependencyLock, dependencyHolder);
    }
  }
  const pluginControl = acquirePluginBuildLock(pluginLock);
  let dependencyControl: ReturnType<typeof acquireDependencyBuildLock> = null;
  try {
    assert.notEqual(pluginControl, null);
    dependencyControl = acquireDependencyBuildLock(dependencyLock);
    assert.notEqual(dependencyControl, null);
  } finally {
    try {
      if (pluginControl !== null) releasePluginBuildLock(pluginLock, pluginControl);
    } finally {
      if (dependencyControl !== null) releaseDependencyBuildLock(dependencyLock, dependencyControl);
    }
  }

  const fencedLock = path.join(root, "fenced-plugin.lock");
  const original = acquirePluginBuildLock(fencedLock);
  assert.notEqual(original, null);
  if (original === null) assert.fail("expected original plugin lease");
  let successor: ReturnType<typeof acquirePluginBuildLock> = null;
  try {
    const first = inspectPluginBuildLock(fencedLock);
    const second = inspectPluginBuildLock(fencedLock);
    assert.equal(first.state, "active");
    assert.equal(second.state, "active");
    if (first.state !== "active" || second.state !== "active")
      assert.fail("expected two captured active plugin fences");
    const originalFence = { protocol: "v3", generation: original.generation };
    assert.deepEqual(first.fence, originalFence);
    assert.deepEqual(second.fence, originalFence);
    assert.equal(reclaimPluginBuildLock(fencedLock, first.fence), true);
    successor = acquirePluginBuildLock(fencedLock);
    assert.notEqual(successor, null);
    if (successor === null) assert.fail("expected plugin successor");
    assert.notEqual(successor.generation, original.generation);
    assert.equal(releasePluginBuildLock(fencedLock, original), false);
    assert.equal(reclaimPluginBuildLock(fencedLock, second.fence), false);
    const current = inspectPluginBuildLock(fencedLock);
    assert.equal(current.state, "active");
    assert.deepEqual(current.state === "active" ? current.fence : null, {
      protocol: "v3", generation: successor.generation,
    });
    assert.equal(releasePluginBuildLock(fencedLock, successor), true);
    assert.deepEqual(inspectPluginBuildLock(fencedLock), { state: "released" });
    for (const generation of [original.generation, successor.generation])
      assert.equal(fs.existsSync(path.join(`${fencedLock}.v3`, "retired", generation)), true);
  } finally {
    try { releasePluginBuildLock(fencedLock, original); }
    finally { if (successor !== null) releasePluginBuildLock(fencedLock, successor); }
  }

  const legacyLock = path.join(root, "legacy-plugin.lock");
  fs.mkdirSync(legacyLock);
  fs.writeFileSync(path.join(legacyLock, "owner.json"), JSON.stringify({
    hostname: os.hostname(), pid: process.pid, startedAt: new Date().toISOString(),
  }), "utf8");
  const legacy = inspectPluginBuildLock(legacyLock);
  assert.equal(legacy.state, "active");
  if (legacy.state !== "active") assert.fail("expected active legacy owner");
  assert.equal(legacy.fence.protocol, "legacy");
  // This owned fixture models normal legacy pathname removal, not process exit.
  fs.rmSync(legacyLock, { recursive: true });
  const legacySuccessor = acquirePluginBuildLock(legacyLock);
  assert.notEqual(legacySuccessor, null);
  if (legacySuccessor === null) assert.fail("expected v3 successor after legacy removal");
  try {
    assert.equal(reclaimPluginBuildLock(legacyLock, legacy.fence), false);
    const current = inspectPluginBuildLock(legacyLock);
    assert.equal(current.state, "active");
    assert.deepEqual(current.state === "active" ? current.fence : null, {
      protocol: "v3", generation: legacySuccessor.generation,
    });
    assert.equal(releasePluginBuildLock(legacyLock, legacySuccessor), true);
    assert.deepEqual(inspectPluginBuildLock(legacyLock), { state: "released" });
  } finally {
    releasePluginBuildLock(legacyLock, legacySuccessor);
  }
  await verifyPluginActorFencing();
}

async function verifyPluginActorFencing(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-plugin-actor-fences-"));
  const lock = path.join(root, "entry.lock");
  const loader = new URL("../../../../../config/register-unit-loader.mjs", import.meta.url).href;
  const api = fileURLToPath(new URL("../../../../../packages/ttsc/src/plugin/internal/source/", import.meta.url));
  const gates = ["legacy-release", "a-observe", "a-start", "b-start", "a-publish", "b-read", "b-successor", "a-finalize", "b-finalize"];
  const failures: Error[] = [];
  let retainRoot = false;
  type Outcome = { status: number | null; signal: NodeJS.Signals | null; pid: number | undefined; stdout: string; stderr: string };
  const workers: Promise<Outcome>[] = [];
  const check = (name: string, action: () => void): void => {
    try { action(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
  const open = (name: string): void => { fs.writeFileSync(path.join(root, name), "release\n", "utf8"); };
  const read = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  const lease = (name: string): PluginBuildLockLease => {
    const value = read(name);
    assert.ok(typeof value === "object" && value !== null);
    assert.ok("protocol" in value && value.protocol === "v3");
    assert.ok("generation" in value && typeof value.generation === "string");
    assert.ok("completionNonce" in value && typeof value.completionNonce === "string");
    return { protocol: value.protocol, generation: value.generation, completionNonce: value.completionNonce };
  };
  const wait = async (name: string): Promise<void> => {
    const deadline = Date.now() + 60_000;
    while (!fs.existsSync(path.join(root, name))) {
      assert.ok(Date.now() <= deadline, `timed out waiting for ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const start = (role: string): Promise<Outcome> => {
    const result = new Promise<Outcome>((resolve, reject) => {
      const child = childProcess.spawn(process.execPath, ["--import", loader, path.join(root, "worker.cjs"), role], {
        env: { ...process.env, LOCK_ROOT: root, LOCK_API: api },
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout: 120_000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once("error", (cause) => { retainRoot = true; reject(cause); });
      child.once("close", (status, signal) => {
        if (status === null && signal === null) retainRoot = true;
        resolve({ status, signal, pid: child.pid, stdout, stderr });
      });
    });
    workers.push(result);
    void result.catch(() => undefined);
    return result;
  };
  try {
    fs.writeFileSync(path.join(root, "worker.cjs"), [
      'const fs = require("node:fs"), os = require("node:os"), path = require("node:path");',
      'const root = process.env.LOCK_ROOT, api = process.env.LOCK_API, role = process.argv[2];',
      'const lock = path.join(root, "entry.lock"), binary = path.join(root, "plugin.bin");',
      'const { acquirePluginBuildLock: acquire } = require(path.join(api, "acquirePluginBuildLock.ts"));',
      'const { inspectPluginBuildLock: inspect } = require(path.join(api, "inspectPluginBuildLock.ts"));',
      'const { reclaimPluginBuildLock: reclaim } = require(path.join(api, "reclaimPluginBuildLock.ts"));',
      'const { releasePluginBuildLock: release } = require(path.join(api, "releasePluginBuildLock.ts"));',
      'const write = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value), "utf8");',
      'function wait(name) { const end = Date.now() + 90000; while (!fs.existsSync(path.join(root, name))) { if (Date.now() > end) throw Error("gate timeout " + name); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10); } }',
      'if (role === "seed") { const held = acquire(lock); if (!held) throw Error("seed acquisition failed"); write("seed.json", held); }',
      'else {',
      '  if (role === "a") {',
      '    fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({hostname:os.hostname(), pid:process.pid, startedAt:new Date().toISOString()}));',
      '    write("legacy-ready.json", true); wait("legacy-release"); fs.rmSync(lock, {recursive:true}); write("legacy-gone.json", true); wait("a-observe");',
      '  }',
      '  const old = inspect(lock); if (old.state !== "abandoned") throw Error("expected departed seed"); write(role + "-ready.json", old.fence); wait(role + "-start");',
      '  const reclaimed = reclaim(lock, old.fence); let held = acquire(lock); write(role + "-observed.json", {reclaimed, holding:held !== null});',
      '  if (role === "a") {',
      '    if (!held) throw Error("A failed acquisition"); write("a-lease.json", held);',
      '    try { wait("a-publish"); fs.appendFileSync(path.join(root,"build.log"),"a\\n"); fs.writeFileSync(binary + ".tmp", "plugin\\n"); fs.renameSync(binary + ".tmp", binary); write("published.json",true); wait("a-finalize"); }',
      '    finally { write("a-result.json", {released:release(lock,held)}); }',
      '  } else {',
      '    if (held) { release(lock,held); throw Error("stale B acquired active A"); }',
      '    wait("b-read"); write("b-artifact.json",{built:false, bytes:fs.readFileSync(binary,"utf8")}); wait("b-successor"); held = acquire(lock); if (!held) throw Error("B successor acquisition failed"); write("b-lease.json",held);',
      '    try { wait("b-finalize"); } finally { write("b-result.json",{released:release(lock,held)}); }',
      '  }',
      '}', "",
    ].join("\n"), "utf8");
    fs.writeFileSync(path.join(root, "package.json"), '{"type":"commonjs"}\n', "utf8");
    const a = start("a");
    await wait("legacy-ready.json");
    const legacy = inspectPluginBuildLock(lock);
    assert.equal(legacy.state, "active");
    if (legacy.state !== "active") assert.fail("expected native legacy holder");
    assert.equal(legacy.fence.protocol, "legacy");
    open("legacy-release");
    await wait("legacy-gone.json");
    const seedResult = await start("seed");
    assert.equal(seedResult.status, 0, seedResult.stderr);
    assert.equal(seedResult.signal, null, seedResult.stderr);
    const seedPid = seedResult.pid;
    assert.ok(seedPid !== undefined && seedPid > 0 && Number.isInteger(seedPid));
    assert.throws(() => process.kill(seedPid, 0), { code: "ESRCH" });
    const seed = lease("seed.json");
    const seedFence = { protocol: seed.protocol, generation: seed.generation };
    const departed = inspectPluginBuildLock(lock);
    assert.equal(departed.state, "abandoned");
    assert.deepEqual(departed.state === "abandoned" ? departed.fence : null, seedFence);
    const b = start("b");
    open("a-observe");
    await Promise.all([wait("a-ready.json"), wait("b-ready.json")]);
    for (const role of ["a", "b"])
      check(role + " departed fence", () => assert.deepEqual(read(role + "-ready.json"), seedFence));
    open("a-start"); await wait("a-lease.json");
    const old = lease("a-lease.json");
    open("b-start"); await wait("b-observed.json");
    check("one stale observer wins", () => {
      assert.deepEqual(read("a-observed.json"), { reclaimed: true, holding: true });
      assert.deepEqual(read("b-observed.json"), { reclaimed: false, holding: false });
      assert.equal(fs.existsSync(path.join(root, "b-lease.json")), false);
      const current = inspectPluginBuildLock(lock);
      assert.equal(current.state, "active");
      assert.deepEqual(current.state === "active" ? current.fence : null, {protocol:old.protocol,generation:old.generation});
    });
    open("a-publish"); await wait("published.json");
    open("b-read"); await wait("b-artifact.json");
    check("single publication reused", () => {
      assert.equal(fs.readFileSync(path.join(root, "build.log"), "utf8"), "a\n");
      assert.equal(fs.readFileSync(path.join(root, "plugin.bin"), "utf8"), "plugin\n");
      assert.deepEqual(read("b-artifact.json"), {built:false,bytes:"plugin\n"});
    });
    assert.equal(reclaimPluginBuildLock(lock, old), true);
    open("b-successor"); await wait("b-lease.json");
    const successor = lease("b-lease.json");
    open("a-finalize"); await wait("a-result.json");
    await a;
    check("late finalizer and legacy observer preserve B", () => {
      assert.deepEqual(read("a-result.json"), {released:false});
      assert.equal(reclaimPluginBuildLock(lock, legacy.fence), false);
      const current = inspectPluginBuildLock(lock);
      assert.equal(current.state, "active");
      assert.deepEqual(current.state === "active" ? current.fence : null, {protocol:successor.protocol,generation:successor.generation});
    });
    open("b-finalize"); await b;
    check("successor release and retained history", () => {
      assert.deepEqual(read("b-result.json"), {released:true});
      assert.deepEqual(inspectPluginBuildLock(lock), {state:"released"});
      for (const held of [seed, old, successor])
        assert.equal(fs.existsSync(path.join(`${lock}.v3`, "retired", held.generation)), true);
    });
  } catch (cause) {
    failures.push(new Error("plugin actor fencing DAG", { cause }));
  } finally {
    for (const gate of gates) check("finally releases " + gate, () => open(gate));
    for (const [index, outcome] of (await Promise.allSettled(workers)).entries()) {
      if (outcome.status === "rejected") failures.push(new Error(`worker ${index} close`, { cause: outcome.reason }));
      else check(`worker ${index} exit`, () => {
        assert.equal(outcome.value.status, 0, outcome.value.stderr);
        assert.equal(outcome.value.signal, null, outcome.value.stderr);
      });
    }
    if (retainRoot) console.error("unresolved plugin actor inputs retained", root);
    else check("plugin actor root cleanup", () => fs.rmSync(root, {recursive:true,force:true}));
  }
  if (failures.length !== 0) throw new AggregateError(failures, "plugin actor fencing observations failed");
}
