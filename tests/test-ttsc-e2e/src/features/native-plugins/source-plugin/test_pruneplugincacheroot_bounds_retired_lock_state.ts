import { TestProject } from "@ttsc/testing";
import child_process from "node:child_process";

import {
  acquirePluginBuildLock,
  assert,
  fs,
  path,
  prunePluginCacheRoot,
  releasePluginBuildLock,
} from "../../../internal/source-build";

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
 * @evidence contracts/testing.md#independent-expectations Explicit last-used timestamps place one entry beyond the 30-day policy, and real exited versus current PIDs establish the two holder premises. Literal path-presence expectations define payload and fence lifetimes independently of random generation ordering.
 * @evidence contracts/testing.md#distinguishing-cases Old payload versus fresh entry and dead versus live retired ownership retain distinct outcomes. The helper locates each newly created tombstone by set difference and asserts exactly one, avoiding random-name ordering assumptions.
 * @evidence contracts/testing.md#execution-ownership The exported entry calls shipped acquire/release/prune APIs over actual generation records and a real completed-process PID; it does not compile Go or load a contributor host.
 * @evidence contracts/e2e.md#necessary-boundary The collector must connect actual local owner absence to safe tombstone deletion while preserving a still-live capability holder. Pure age/LRU policy alone cannot establish that native process-liveness connection.
 * @evidence contracts/e2e.md#shared-execution One plugin-cache root and retire helper supply old/fresh entries and both retired owners. One completed child supplies the native dead-holder witness; no per-generation compiler build is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private payload and coordination roots isolate collection. Fixture leases are released before pruning, while the current process remains a live holder of its history; the seed child must exit zero and supply a positive native PID before recording its absent-owner premise.
 * @evidence contracts/e2e.md#preserved-coverage Original acquisition/new-tombstone controls and every payload/root/live/dead presence assertion remain. Observer-population and unfinished-task distinctions are not added by this acknowledgment and retain their other owners.
 */
export const test_pruneplugincacheroot_bounds_retired_lock_state = (): void => {
  const root = path.join(
    TestProject.tmpdir("ttsc-plugin-cache-tombstones-"),
    "plugins",
  );
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
  assert.equal(exited.status, 0, exited.error?.message);
  const deadPid = exited.pid;
  assert.ok(deadPid > 0);
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
