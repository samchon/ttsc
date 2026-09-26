import { TestProject } from "@ttsc/testing";
import child_process from "node:child_process";

import {
  acquirePluginBuildLock,
  assert,
  fs,
  path,
  prunePluginCacheRoot,
  releasePluginBuildLock,
} from "../../internal/source-build";

/**
 * Verifies the plugin cache collector bounds the build-lock state it leaves
 * behind, without freeing a tombstone whose holder may still act.
 *
 * Releasing a build lock renames the held generation onto a
 * `retired/<generation>` tombstone, which fences a late release of that
 * generation. The collector skipped every lock directory, so an evicted entry's
 * lock state, and the tombstones of repeated builds, stayed forever
 * (samchon/ttsc#1558). An evicted entry now takes its inactive lock state with
 * it, and a tombstone goes once its recorded holder is provably gone.
 *
 * 1. Build and release a generation for an old entry, and evict it.
 * 2. Assert the entry and its lock directory are both gone.
 * 3. For a live entry, retire one generation recorded for a dead process and one
 *    for this process, and assert only the dead holder's tombstone goes.
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
    const lease = acquirePluginBuildLock(`${entry}.lock`);
    assert.ok(lease, "fixture failed to acquire a generation");
    releasePluginBuildLock(`${entry}.lock`, lease);
    const retired = path.join(`${entry}.lock.v2`, "retired");
    const tombstones = fs.readdirSync(retired);
    return path.join(retired, tombstones[tombstones.length - 1]!);
  };

  const evicted = seed("evicted", now - 31 * 24 * 60 * 60 * 1000);
  retire(evicted);
  assert.equal(fs.existsSync(`${evicted}.lock.v2`), true);

  const live = seed("live", now);
  const dead = retire(live);
  const deadPid = child_process.spawnSync(process.execPath, ["-e", ""]).pid;
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
    fs.existsSync(`${evicted}.lock.v2`),
    false,
    "its lock state goes with it",
  );
  assert.equal(fs.existsSync(live), true);
  assert.equal(fs.existsSync(dead), false, "a gone holder's tombstone goes");
  assert.equal(fs.existsSync(own), true, "a live holder's tombstone stays");
};
