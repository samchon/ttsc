import { TestProject } from "@ttsc/testing";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };

import {
  acquirePluginBuildLock,
  assert,
  fs,
  path,
  prunePluginCacheRoot,
  releasePluginBuildLock,
} from "../../../../internal/ttsc/internal/source-build";

/**
 * Verifies the plugin cache collector bounds the build-lock state it leaves
 * behind, without freeing a tombstone whose holder may still act.
 *
 * Releasing a build lock renames the held generation onto a
 * `retired/<generation>` tombstone, which fences a late release of that
 * generation. The collector skipped every lock directory, so an evicted entry's
 * lock state, and the tombstones of repeated builds, stayed forever
 * (samchon/ttsc#1558). An evicted entry leaves its coordination root intact,
 * and a tombstone goes only once its recorded holder and observers are gone.
 *
 * 1. Build and release a generation for an old entry, and evict it.
 * 2. Assert the entry is gone while its still-observable lock root remains.
 * 3. For a live entry, retire one generation recorded for a dead process and one
 *    for this process, and assert only the dead holder's tombstone goes.
 *
 * @evidence contracts/testing.md#behavioral-verification Plugin-cache pruning must evict the old payload while preserving its observable lock root, delete a dead holder's retired generation and keep the live holder's tombstone plus the current payload.
 * @evidence contracts/testing.md#independent-expectations Explicit last-used timestamps place one entry beyond the 30-day policy; setup error/signal/status, positive safe PID and independent native ESRCH establish the absent-owner input against the current live PID. PID reuse remains possible. Literal path-presence expectations define payload and fence lifetimes independently of random generation ordering.
 * @evidence contracts/testing.md#distinguishing-cases Old payload versus fresh entry and dead versus live retired ownership retain distinct outcomes. The helper locates each newly created tombstone by set difference and asserts exactly one, avoiding random-name ordering assumptions.
 * @evidence contracts/testing.md#execution-ownership The named generic entry directly calls built workspace acquire/release/prune over actual native inputs. The Node child supplies setup PID only; no compiler, installed consumer, native plugin producer or product host protocol is exercised.
 * @evidenceExclude contracts/e2e.md#necessary-boundary Direct pruning ownership with native PID/filesystem inputs is unit-first. Exact counterpart tests/test-ttsc/src/features/source-plugin/test_pruneplugincacheroot_preserves_live_retired_ownership.ts preserves this matrix; it is authored but actual selection/execution/survival remains unverified.
 * @evidence contracts/e2e.md#shared-execution Existing root/retire helper and one completed setup child remain until exact direct counterpart execution permits duplicate-call removal. This is not an achieved E2E family or process-cost reduction.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked temporary root is retained before preparation. Fixture leases release before pruning; child launch/signal/status and native ESRCH precede absent-owner recording. The current PID retains live history. Neither synchronous return nor root retention proves arbitrary descendant closure.
 * @evidence contracts/e2e.md#preserved-coverage Original acquisition/new-tombstone controls, old31day/fresh inputs and all five payload/root/live/dead presence assertions remain, with strengthened native setup. Exact direct counterpart b5bfc52a5afc7b86743506ecff4ba28a71ec2790 is authored/unexecuted; donor stays until actual survival. Observer/unfinished-task/byte-bound behavior is not asserted here.
 */
export const test_pruneplugincacheroot_bounds_retired_lock_state = (): void => {
  const temporaryRoot = TestProject.tmpdir("ttsc-plugin-cache-tombstones-");
  TestProject.retainTemporaryDirectory(temporaryRoot, "retired-owner native setup has no descendant join acknowledgement");
  const root = path.join(temporaryRoot, "plugins");
  fs.mkdirSync(root, { recursive: true });
  const now = Date.now();
  const seed = (name: string, lastUsed: number): string => {
    const directory = path.join(root, name);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "plugin"), name, "utf8");
    fs.writeFileSync(path.join(directory, ".last-used"), `${lastUsed}\n`);
    return directory;
  };
  const retire = (entry: string): string => {
    const retiredBefore = path.join(`${entry}.lock.v3`, "retired");
    const existing = new Set(
      fs.existsSync(retiredBefore) ? fs.readdirSync(retiredBefore) : [],
    );
    const lease = acquirePluginBuildLock(`${entry}.lock`);
    assert.ok(lease, "fixture failed to acquire a generation");
    releasePluginBuildLock(`${entry}.lock`, lease);
    const retired = path.join(`${entry}.lock.v3`, "retired");
    // Tombstones are named by random generation ids, so the one this release
    // wrote is the name that was not there before, not the last in any order.
    const created = fs
      .readdirSync(retired)
      .filter((name) => !existing.has(name));
    assert.equal(created.length, 1, created.join(", "));
    return path.join(retired, created[0]!);
  };

  const evicted = seed("evicted", now - 31 * 24 * 60 * 60 * 1000);
  retire(evicted);
  assert.equal(fs.existsSync(`${evicted}.lock.v3`), true);

  const live = seed("live", now);
  const dead = retire(live);
  const exited = child_process.spawnSync(process.execPath, ["-e", ""], {
    windowsHide: true,
  });
  assert.equal(exited.error, undefined, "retired-owner setup child launch error");
  assert.equal(exited.signal, null, "retired-owner setup child terminated by signal");
  assert.equal(exited.status, 0, exited.error?.message);
  const deadPid = exited.pid;
  assert.ok(Number.isSafeInteger(deadPid) && deadPid > 0);
  let absence: unknown;
  try { process.kill(deadPid, 0); }
  catch (error) { absence = error; }
  assert.equal((absence as NodeJS.ErrnoException | undefined)?.code, "ESRCH", "only ESRCH proves the recorded retired owner absent");
  const owner = JSON.parse(
    fs.readFileSync(path.join(dead, "owner.json"), "utf8"),
  ) as Record<string, unknown>;
  fs.writeFileSync(
    path.join(dead, "owner.json"),
    JSON.stringify({ ...owner, pid: deadPid }),
  );
  const own = retire(live);
  assert.notEqual(own, dead);

  prunePluginCacheRoot(root, { force: true, now });

  assert.equal(fs.existsSync(evicted), false, "the old entry is evicted");
  assert.equal(
    fs.existsSync(`${evicted}.lock.v3`),
    true,
    "a live holder can still hold a fence after its binary is evicted",
  );
  assert.equal(fs.existsSync(live), true);
  assert.equal(fs.existsSync(dead), false, "a gone holder's tombstone goes");
  assert.equal(fs.existsSync(own), true, "a live holder's tombstone stays");
};
