import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";
import { reclaimPluginBuildLock } from "../../../../packages/ttsc/lib/plugin/internal/source/reclaimPluginBuildLock";
import type { createLoaderPoolWorker } from "./LoaderPoolWorker";

/**
 * Reuse both adapter residents as lock observers and finalizers. One genuinely
 * exited seed is the only additional process. Ordered actual command replies
 * replace file gates, and the caller joins the residents at their normal close.
 *
 * @evidence contracts/testing.md#behavioral-verification A real legacy owner releases its pathname, an exited seed establishes an abandoned generation, and two resident observers capture the same fence before one reclaims it. Publication/reuse and delayed release distinguish competing owners.
 * @evidence contracts/testing.md#independent-expectations Literal acquire/reclaim/release results, exact fences, one build-log line, artifact bytes and retained tombstones distinguish generations. Positive seed PID and ESRCH after ordinary close establish actual process absence.
 * @evidence contracts/testing.md#distinguishing-cases Dead seed, winning observer, losing observer, live owner retirement, stale legacy fence, delayed finalizer and normal successor release use one namespace.
 * @evidence contracts/testing.md#execution-ownership Two existing adapter processes retain their actual state across command/reply barriers; one added seed exits. The caller owns final resident close. Literal plugin bytes are lock-publication inputs, not a compiled Go binary or SDK certificate. PID reuse and arbitrary descendant closure are not certified.
 * @evidence contracts/e2e.md#necessary-boundary Actual process liveness, independent captured fences, persistent lease state and cross-process publication cannot be owned by same-process token policy alone.
 * @evidence contracts/e2e.md#shared-execution Existing Metro and Turbopack residents share this lock state graph without another observer host or per-original preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One caller-owned cache subtree isolates coordination outputs from semantic project inputs; residents release held leases in finally before their joined closes.
 * @evidence contracts/e2e.md#preserved-coverage The old finalizer, legacy observer and two stale observers retain actual abandoned admission, competing claim, one publication/reuse, successor fencing, tombstone and close ownership.
 */
export async function observePluginLockGraph(props: {
  root: string; fixture: string; api: string;
  workers: ReturnType<typeof createLoaderPoolWorker>[];
}): Promise<void> {
  assert.equal(fs.existsSync(props.root), false);
  fs.mkdirSync(props.root, { recursive: true });
  const command = async (index: number, action: string): Promise<any> => {
    const reply = await props.workers[index]!.pluginLock({ root: props.root, api: props.api, action });
    assert.equal(reply.error, undefined, action + ": " + reply.error);
    return reply.value;
  };
  const legacy = await command(0, "legacy");
  assert.equal(legacy.state, "active");
  assert.equal(legacy.fence.protocol, "legacy");
  assert.deepEqual(await command(0, "legacy-release"), { state: "released" });
  E2eProcessTrace.fixturePaths(path.dirname(props.fixture), [path.basename(props.fixture)]);
  const seed = E2eProcessTrace.spawnSync(process.execPath, [props.fixture, props.root, props.api], {
    encoding: "utf8", windowsHide: true, timeout: 120_000,
  });
  assert.equal(seed.error, undefined);
  assert.equal(seed.status, 0, seed.stderr);
  assert.equal(seed.signal, null, seed.stderr);
  assert.ok(Number.isInteger(seed.pid) && seed.pid > 0);
  assert.throws(() => process.kill(seed.pid, 0), { code: "ESRCH" });
  const seedLease = JSON.parse(seed.stdout);
  assert.equal(seedLease.protocol, "v3");
  assert.equal(typeof seedLease.generation, "string");
  const fence = { protocol: "v3", generation: seedLease.generation };
  const captured = await Promise.all([command(0, "capture"), command(1, "capture")]);
  for (const observed of captured) {
    assert.equal(observed.state, "abandoned");
    assert.deepEqual(observed.fence, fence);
  }
  const first = await command(0, "reclaim-acquire");
  assert.equal(first.reclaimed, true);
  assert.notEqual(first.lease, null);
  const activeA = { state: "active", fence: { protocol: "v3", generation: first.lease.generation } };
  // Inspect includes owner metadata; compare its state/fence independently.
  assert.equal(first.current.state, activeA.state);
  assert.deepEqual(first.current.fence, activeA.fence);
  const second = await command(1, "reclaim-acquire");
  assert.equal(second.reclaimed, false);
  assert.equal(second.lease, null);
  assert.equal(second.current.state, "active");
  assert.deepEqual(second.current.fence, activeA.fence);
  assert.deepEqual(await command(0, "publish"), { bytes: "plugin\n", log: "a\n" });
  assert.deepEqual(await command(1, "reuse"), { built: false, bytes: "plugin\n" });
  assert.equal(reclaimPluginBuildLock(path.join(props.root, "entry.lock"), activeA.fence), true);
  const successor = await command(1, "successor");
  assert.notEqual(successor.lease, null);
  assert.notEqual(successor.lease.generation, first.lease.generation);
  const finalizer = await command(0, "finalize");
  assert.equal(finalizer.released, false);
  assert.equal(finalizer.current.state, "active");
  assert.deepEqual(finalizer.current.fence, { protocol: "v3", generation: successor.lease.generation });
  const staleLegacy = await command(0, "stale-legacy");
  assert.equal(staleLegacy.reclaimed, false);
  assert.equal(staleLegacy.current.state, "active");
  assert.deepEqual(staleLegacy.current.fence, finalizer.current.fence);
  assert.deepEqual(await command(1, "finalize"), { released: true, current: { state: "released" } });
  assert.equal(fs.readFileSync(path.join(props.root, "build.log"), "utf8"), "a\n");
  for (const generation of [seedLease.generation, first.lease.generation, successor.lease.generation])
    assert.equal(fs.existsSync(path.join(props.root, "entry.lock.v3", "retired", generation)), true);
}
