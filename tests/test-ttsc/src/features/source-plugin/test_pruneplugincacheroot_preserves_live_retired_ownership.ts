import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { prunePluginCacheRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/prunePluginCacheRoot";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";

/**
 * Verifies payload eviction and retired lock ownership have separate lifetimes.
 *
 * Actual acquire/release calls produce the generations. Their empty fixture
 * tasks finish before release. An exited owned child supplies a native absent
 * PID for one qualified retired record; the other retains this live process.
 * No observer or unfinished-task population is introduced by this case.
 *
 * 1. Release a generation for a payload last used 31 days before supplied now.
 * 2. Release two fresh-entry generations, recording absent and live local PIDs.
 * 3. Prune and require old payload eviction, root retention, fresh payload
 *    retention, absent tombstone deletion and live tombstone retention.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual collector must evict the old payload without deleting its persistent coordination root, keep the fresh payload, remove the absent holder's retired generation and retain the live holder's generation.
 * @evidence contracts/testing.md#independent-expectations Literal last-used timestamps place one payload 31 days before supplied now. Child status zero plus ESRCH prepare absence independently of the collector; current PID probing establishes the live contrast. Literal path presence and exact newly created tombstone count define expectations independently of random generation order.
 * @evidence contracts/testing.md#distinguishing-cases Old and fresh payloads differ in age while absent and current local retired owners differ in native process existence. Each newly retired generation is located by set difference and must be unique. Observer population and unfinished-task protection retain their separate owners.
 * @evidence contracts/testing.md#execution-ownership This source-unit directly imports authored acquire/release/prune owners and uses private native records, with each acquired empty fixture task released before inspection or pruning. At most eight inert completed children prepare ESRCH; no Go build, installation or product host is needed. Preparation failure is not skipped, and numeric PID reuse after preparation remains possible. TestProject owns temporary cleanup.
 */
export function test_pruneplugincacheroot_preserves_live_retired_ownership(): void {
  const root = path.join(TestProject.tmpdir("ttsc-retired-lock-unit-"), "plugins");
  fs.mkdirSync(root);
  const now = Date.now();
  const deadPid = endedProcessId();
  process.kill(process.pid, 0);
  const seed = (name: string, lastUsed: number): string => {
    const directory = path.join(root, name);
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "plugin"), name, "utf8");
    fs.writeFileSync(path.join(directory, ".last-used"), `${lastUsed}\n`, "utf8");
    return directory;
  };
  const retire = (entry: string): string => {
    const retired = path.join(`${entry}.lock.v3`, "retired");
    const existing = new Set(fs.existsSync(retired) ? fs.readdirSync(retired) : []);
    const lease = acquirePluginBuildLock(`${entry}.lock`);
    assert.ok(lease, "fixture failed to acquire a generation");
    // The fixture task has no payload operation; it is complete before release.
    releasePluginBuildLock(`${entry}.lock`, lease);
    const created = fs.readdirSync(retired).filter((name) => !existing.has(name));
    assert.equal(created.length, 1, created.join(", "));
    return path.join(retired, created[0]!);
  };
  const old = seed("evicted", now - 31 * 24 * 60 * 60 * 1000);
  retire(old);
  assert.equal(fs.existsSync(`${old}.lock.v3`), true);
  const fresh = seed("live", now);
  const dead = retire(fresh);
  const ownerFile = path.join(dead, "owner.json");
  const owner = JSON.parse(fs.readFileSync(ownerFile, "utf8")) as Record<
    string,
    unknown
  >;
  fs.writeFileSync(ownerFile, JSON.stringify({ ...owner, pid: deadPid }), "utf8");
  const live = retire(fresh);
  assert.notEqual(live, dead);

  prunePluginCacheRoot(root, { force: true, now });
  const failures: Error[] = [];
  for (const [name, file, expected] of [
    ["old payload evicted", old, false],
    ["old coordination root retained", `${old}.lock.v3`, true],
    ["fresh payload retained", fresh, true],
    ["absent retired owner removed", dead, false],
    ["live retired owner retained", live, true],
  ] as const) {
    try {
      assert.equal(fs.existsSync(file), expected, name);
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "retired lock collection assertions failed");
}

function endedProcessId(): number {
  for (let attempt = 0; attempt < 8; attempt++) {
    const child = childProcess.spawnSync(process.execPath, ["-e", ""], {
      windowsHide: true,
    });
    assert.equal(child.status, 0, child.stderr?.toString());
    assert.ok(child.pid > 0);
    try {
      process.kill(child.pid, 0);
    } catch (error) {
      assert.equal(
        (error as NodeJS.ErrnoException).code,
        "ESRCH",
        "departed PID preparation must establish absence",
      );
      return child.pid;
    }
  }
  throw new Error(
    "native preparation could not establish an absent owned child PID",
  );
}
