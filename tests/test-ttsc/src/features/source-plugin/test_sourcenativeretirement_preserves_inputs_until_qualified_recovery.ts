import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { resolveSafeCacheCleanupTargets } from "../../../../../packages/ttsc/src/internal/resolveSafeCacheCleanupTargets";
import { GoBuildCacheCoordination } from "../../../../../packages/ttsc/src/plugin/internal/source/GoBuildCacheCoordination";
import { PluginBuildLockProtocol } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockProtocol";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { inspectPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/inspectPluginBuildLock";
import { pruneGoBuildCacheRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/pruneGoBuildCacheRoot";
import { prunePluginCacheRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/prunePluginCacheRoot";
import { reclaimPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/reclaimPluginBuildLock";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";
import { withGoBuildCacheLease } from "../../../../../packages/ttsc/src/plugin/internal/source/withGoBuildCacheLease";
import { waitForPluginBinary } from "../../../../../packages/ttsc/src/plugin/internal/source/waitForPluginBinary";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a still-running native reader keeps its inputs until qualified join.
 *
 * The typed failure boundary owns a real Node filesystem reader, not a Go
 * compiler or native supervisor. Its original ChildProcess handle supplies the
 * recovery proof only after the actual close event.
 *
 * 1. Admit the reader under real key and Go leases, then classify unknown.
 * 2. Attempt stealing, completion, age/size GC and explicit clean independently.
 * 3. Join the original reader and recover only its exact retained boundary.
 *
 * @evidence contracts/testing.md#behavioral-verification Real source lock/Go lease owners and central admission protect an actual reader's file. Unknown retirement must preserve bytes, the exact key generation and Go lease against direct release/reclaim, old-owner PID data, expired metadata, collector pressure and whole-root clean. Qualified recovery after actual child close executes deferred cleanup and permits reacquisition.
 * @evidence contracts/testing.md#independent-expectations A still-live reader's input must remain readable, and a termination request alone cannot authorize deletion. Literal reader bytes, observed current generation, literal object payload and the child's external ENOENT marker distinguish preserved ownership from a passing error wrapper.
 * @evidence contracts/testing.md#distinguishing-cases Pending guard publication precedes reader startup; unknown contrasts with joined recovery, wrong boundary and fresh admission. Independently collected reclamation attempts cover key completion/stealing, plugin and Go GC, PID absence, clock expiry and recursive clean. Ordinary and not-started paths have separate source units.
 * @evidence contracts/testing.md#execution-ownership One source-unit entry owns actual temporary files, source lock/lease operations and one real Node reader without Go or an installed host. Original process close and all heartbeat retirement promises are joined. The explicit classification seam does not claim OS cleanup-refusal or actual cold MCP validation; unconfirmed closure retains the root.
 */
export async function test_sourcenativeretirement_preserves_inputs_until_qualified_recovery(): Promise<void> {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-native-retention-"));
  const plugins = path.join(root, "plugins");
  const cache = path.join(plugins, "entry");
  const lock = `${cache}.lock`;
  const go = path.join(root, "go-build");
  const scratch = path.join(root, "scratch");
  fs.mkdirSync(cache, { recursive: true });
  fs.mkdirSync(scratch);
  fs.mkdirSync(path.join(go, "00"), { recursive: true });
  const input = path.join(scratch, "input.txt");
  const object = path.join(go, "00", "authored-object");
  fs.writeFileSync(input, "reader input");
  fs.writeFileSync(path.join(cache, "plugin"), "plugin payload");
  fs.writeFileSync(object, "Go object payload");
  const aged = new Date(1_000);
  fs.utimesSync(object, aged, aged);
  const ready = path.join(root, "ready");
  const lost = path.join(root, "reader-lost-input");
  const scope = SourceNativeRetirement.createScope("authored-original-task");
  const retirements = new Set<Promise<unknown>>();
  let child: ReturnType<typeof spawn> | undefined;
  let closed: Promise<number | null> | undefined;
  let joined = false;
  let generation = "";
  const failures: unknown[] = [];
  const check = (name: string, task: () => void): void => {
    try { task(); } catch (error) { failures.push(new Error(name, { cause: error })); }
  };
  try {
    SourceNativeRetirement.run(scope, () => OwnedSynchronousProcess.run({ cancel: new SharedArrayBuffer(4), retirements }, () => {
      const lease = acquirePluginBuildLock(lock);
      assert.ok(lease);
      generation = lease.generation;
      try {
        SourceNativeRetirement.register({ fenceRoot: PluginBuildLockProtocol.pluginBuildLockProtocolDir(lock), retainedPaths: [scratch, cache, go] });
        SourceNativeRetirement.register({ fenceRoot: scratch, retainedPaths: [scratch] });
        SourceNativeRetirement.register({ fenceRoot: cache, retainedPaths: [cache] });
        try {
          withGoBuildCacheLease(go, true, () => {
            SourceNativeRetirement.begin("actual-reader-boundary");
            child = spawn(process.execPath, ["-e", `const fs=require('node:fs'); const [input,ready,lost]=process.argv.slice(1); fs.readFileSync(input); fs.writeFileSync(ready,String(process.pid)); setInterval(()=>{try{fs.readFileSync(input);}catch(error){fs.writeFileSync(lost,error.code);}},5);`, input, ready, lost], { stdio: "ignore", windowsHide: true });
            closed = new Promise((resolve) => child!.once("close", resolve));
            const deadline = performance.now() + 5_000;
            while (!fs.existsSync(ready)) {
              assert.ok(performance.now() < deadline, "Actual reader must publish readiness");
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
            }
            SourceNativeRetirement.settle("actual-reader-boundary", "unknown", "authored missing process-tree retirement proof");
          });
        } finally {
          SourceNativeRetirement.release(() => {
            SourceNativeRetirement.forget(scratch);
            SourceNativeRetirement.forget(cache);
            fs.rmSync(scratch, { recursive: true, force: true });
          });
        }
      } finally { releasePluginBuildLock(lock, lease); }
    }));
    await Promise.allSettled(retirements);
    assert.ok(child?.pid);
    process.kill(child.pid, 0);
    const protocol = PluginBuildLockProtocol.pluginBuildLockProtocolDir(lock);
    const current = path.join(protocol, "current");
    const owner = path.join(current, "owner.json");
    // Node-holder absence cannot certify an independently surviving native reader.
    const metadata = JSON.parse(fs.readFileSync(owner, "utf8"));
    fs.writeFileSync(owner, JSON.stringify({ ...metadata, pid: 2_147_483_647 }));
    const now = Date.now() + 100 * 24 * 60 * 60 * 1_000;
    check("next key admission", () => assert.throws(() => acquirePluginBuildLock(lock), /quarantined/));
    check("owner death observation", () => assert.throws(() => inspectPluginBuildLock(lock), /quarantined/));
    check("unknown diagnostic left pending cannot admit or steal", () => {
      const directory = path.join(protocol, ".ttsc-native-retirements");
      const guard = path.join(directory, fs.readdirSync(directory)[0]!);
      const original = fs.readFileSync(guard);
      // Authored persisted-state input models a failed unknown update; the
      // separate protocol case owns the actual rename-refusal boundary.
      fs.writeFileSync(guard, JSON.stringify({ ...JSON.parse(original.toString()), state: "pending", reason: undefined }));
      try {
        assert.equal(acquirePluginBuildLock(lock), null);
        assert.equal(inspectPluginBuildLock(lock).state, "active");
        assert.throws(() => waitForPluginBinary({ binaryPath: path.join(cache, "plugin"), lockDir: lock, lockInfo: { label: "plugin", pluginName: "pending-diagnostic", quiet: true }, timeoutMs: 0 }), /timed out.*retained paths/);
        assert.throws(() => reclaimPluginBuildLock(lock, { protocol: "v3", generation }), /protected/);
        assert.equal(fs.readFileSync(input, "utf8"), "reader input");
      } finally { fs.writeFileSync(guard, original); }
    });
    check("direct retirement", () => assert.throws(() => reclaimPluginBuildLock(lock, { protocol: "v3", generation }), /protected/));
    check("direct completion", () => assert.throws(() => releasePluginBuildLock(lock, { protocol: "v3", generation, completionNonce: metadata.completionNonce }), /protected/));
    check("plugin age and size", () => {
      prunePluginCacheRoot(plugins, { force: true, now, maxBytes: 0, targetBytes: 0, protectedAgeMs: 0 });
      assert.equal(fs.readFileSync(path.join(cache, "plugin"), "utf8"), "plugin payload");
      assert.equal(fs.readFileSync(path.join(current, "generation"), "utf8").trim(), generation);
    });
    check("Go lease age", () => assert.equal(GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(go, GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR, now).length, 1));
    check("expired maintenance does not serialize independent builds", () => {
      const directory = path.join(go, GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR);
      fs.mkdirSync(directory, { recursive: true });
      const record = path.join(directory, "authored-expired-maintenance.json");
      fs.writeFileSync(record, JSON.stringify({ version: 1, pid: 2_147_483_647, hostname: os.hostname(), startedAt: 1_000, status: "active" }));
      fs.utimesSync(record, aged, aged);
      try { assert.deepEqual(GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(go, GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR, now), []); }
      finally { fs.rmSync(record, { force: true }); }
    });
    check("independent key shares protected Go cache", () => {
      const otherScope = SourceNativeRetirement.createScope("independent-key-task");
      const otherLock = `${path.join(plugins, "independent")}.lock`;
      SourceNativeRetirement.run(otherScope, () => {
        const other = acquirePluginBuildLock(otherLock);
        assert.ok(other);
        try {
          withGoBuildCacheLease(go, true, (shared) => {
            assert.equal(shared, go);
            SourceNativeRetirement.begin("independent-command");
            SourceNativeRetirement.settle("independent-command", "joined");
          });
        } finally { releasePluginBuildLock(otherLock, other); }
      });
      assert.equal(SourceNativeRetirement.isProtected(go), true);
      assert.equal(GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(go, GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR, now).length, 1);
    });
    check("Go object pruning", () => {
      pruneGoBuildCacheRoot(go, { force: true, now, maxBytes: 0, targetBytes: 0, protectedAgeMs: 0 });
      assert.equal(fs.readFileSync(object, "utf8"), "Go object payload");
    });
    check("explicit recursive clean", () => assert.throws(() => resolveSafeCacheCleanupTargets(path.join(root, "project"), [plugins, go]), /protected/));
    check("direct scratch clean", () => assert.throws(() => SourceNativeRetirement.assertCleanable(scratch), /protected/));
    check("direct payload clean", () => assert.throws(() => SourceNativeRetirement.assertCleanable(cache), /protected/));
    check("wrong recovery boundary", () => assert.throws(() => SourceNativeRetirement.recover(scope, "another-boundary", "joined"), /unresolved/));
    await new Promise((resolve) => setTimeout(resolve, 50));
    check("reader still owns input", () => {
      process.kill(child!.pid!, 0);
      assert.equal(fs.readFileSync(input, "utf8"), "reader input");
      assert.equal(fs.existsSync(lost), false);
    });
    console.info("native-retention before-qualified-join", JSON.stringify({ pid: child.pid, input, bytes: fs.readFileSync(input, "utf8"), inputLossReported: fs.existsSync(lost), keyGeneration: generation, keyCurrentExists: fs.existsSync(current), goLeaseRecords: fs.readdirSync(path.join(go, GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR)), consequenceFailures: failures.length }));
    assert.equal(child.kill(), true);
    await closed;
    joined = true;
    SourceNativeRetirement.recover(scope, "actual-reader-boundary", "joined");
    assert.equal(fs.existsSync(scratch), false);
    assert.equal(fs.existsSync(current), false);
    assert.deepEqual(fs.readdirSync(path.join(go, GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR)), []);
    const next = acquirePluginBuildLock(lock);
    assert.ok(next);
    releasePluginBuildLock(lock, next);
    console.info("native-retention after-qualified-join", JSON.stringify({ pid: child.pid, actualCloseJoined: joined, scratchExists: fs.existsSync(scratch), keyCurrentExists: fs.existsSync(current), goLeaseRecords: fs.readdirSync(path.join(go, GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR)), subsequentKeyAdmissionCompleted: true }));
  } finally {
    if (child !== undefined && !joined) {
      child.kill();
      await closed;
      joined = true;
    }
    await Promise.allSettled(retirements);
    if (!joined || SourceNativeRetirement.isProtected(PluginBuildLockProtocol.pluginBuildLockProtocolDir(lock)))
      TestProject.retainTemporaryDirectory(root, "Native retention regression did not confirm complete qualified recovery");
  }
  if (failures.length !== 0) throw new AggregateError(failures, "Native retention consequence assertions failed");
}
