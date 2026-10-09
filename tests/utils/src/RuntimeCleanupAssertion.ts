import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Validates one completed cleanup invocation against its raw owner observations.
 *
 * The caller supplies independently admitted launcher/main identities, the
 * selected generation and actual retained record names. Cleanup records carry
 * the launcher's native process cwd; the requested launch spelling may differ
 * while naming that same directory. Every frame must retain one raw cwd.
 * This assertion does not join processes, probe PIDs or delete outputs.
 *
 * @evidence contracts/common.md#principled-implementation Native realpath binds the recorded process cwd to the requested directory, while exact invocation frames and raw ESRCH/presence/remote/unknown observations independently determine removal or protection.
 * @evidence contracts/common.md#clear-and-simple-design One existing scan assertion serves E2E and direct units; the caller retains actual launcher completion, source/map evidence and physical deletion checks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No platform prefix, case folding, PID probe, selected-answer expectation, retry or process policy supplies identity or eligibility. Foreign and incomplete frames fail.
 * @evidence contracts/common.md#meaningful-documentation States independent admission inputs, requested versus process cwd, and the caller's remaining process and filesystem responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation Native filesystem identity accepts directory aliases without OS-name branches; exact raw cwd consistency still rejects mixed invocation evidence.
 * @evidence contracts/performance.md#efficient-algorithms Two native identity reads precede one ordered frame/owner scan; the membership set rejects duplicate records in linear time and space.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each effectful cleanup invocation requires its own raw observations; another scan cannot certify this one.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous identity reads close before return and the local owner set is released with the call; callers own live processes, trace storage and retained generations.
 */
export function assertRuntimeCleanupEligibility(
  rows: Record<string, any>[],
  expected: { launcher: number; owner: number; hostname: string; directory: string;
    cache: string; argv: string[]; cwd: string; ownerNames?: string[] },
): boolean {
  assert.ok(rows.length >= 6, "cleanup must retain its complete original invocation");
  const first = rows[0]!;
  assert.ok(path.isAbsolute(first.cwd) && path.isAbsolute(expected.cwd));
  assert.equal(fs.realpathSync.native(first.cwd), fs.realpathSync.native(expected.cwd));
  assert.ok(Number.isSafeInteger(first.sequence) && first.sequence > 0);
  const seen = new Set<string>();
  let unknown = false;
  let live = false;
  for (const [index, row] of rows.entries()) {
    assert.equal(row.schema, 1);
    assert.equal(row.event, "runtime-cleanup");
    assert.equal(row.writerPid, expected.launcher);
    assert.equal(row.pid, expected.launcher);
    assert.equal(row.instance, first.instance);
    assert.equal(row.invocation, first.invocation);
    assert.ok(typeof row.instance === "string" && row.invocation.startsWith(row.instance + ":"));
    assert.equal(row.sequence, first.sequence + index, "no cleanup frame may be missing");
    assert.deepEqual(row.argv, expected.argv);
    assert.equal(row.cwd, first.cwd, "one cleanup invocation must preserve its recorded cwd");
    assert.equal(row.data.origin, "ttsx-runtime-cleanup");
    assert.equal(row.data.directory, expected.directory);
    assert.equal(row.data.runtimeCacheDir, expected.cache);
    assert.equal(row.data.errorCode, undefined);
    assert.equal(row.data.errorMessage, undefined);
  }
  assert.equal(rows[0]!.data.phase, "attempt");
  assert.equal(rows[1]!.data.phase, "lock-entered");
  const observations = rows.slice(2, -3);
  assert.ok(observations.length > 0, "the actual main owner cannot be an unowned run");
  for (const row of observations) {
    assert.equal(row.data.phase, "owner-observation");
    assert.equal(live, false, "a scan stops at its first non-gone owner");
    const observation = row.data.ownerObservation;
    assert.ok(observation && typeof observation.record === "string" && observation.record === path.basename(observation.record) && observation.record.startsWith("owner-") && observation.record.endsWith(".json"));
    assert.equal(seen.has(observation.record), false);
    seen.add(observation.record);
    assert.notEqual(observation.record, `owner-${expected.launcher}.json`, "the completed CLI relinquishes only its own claim");
    if (observation.result === "invalid-record") {
      assert.equal(observation.owner, undefined);
      unknown = true;
      continue;
    }
    assert.ok(observation.owner && Number.isSafeInteger(observation.owner.pid) && observation.owner.pid > 0);
    assert.equal(observation.record, `owner-${observation.owner.pid}.json`);
    assert.ok(typeof observation.owner.hostname === "string" && observation.owner.hostname.length > 0);
    if (observation.result === "remote") {
      assert.notEqual(observation.owner.hostname.toLowerCase(), expected.hostname.toLowerCase());
      assert.equal(observation.errorCode, undefined);
      live = true;
    } else {
      assert.equal(observation.owner.hostname.toLowerCase(), expected.hostname.toLowerCase());
      if (observation.result === "absent") assert.equal(observation.errorCode, "ESRCH");
      else {
        assert.ok(observation.result === "present" || observation.result === "unknown");
        if (observation.result === "present") assert.equal(observation.errorCode, undefined);
        else assert.notEqual(observation.errorCode, "ESRCH");
        live = true;
      }
    }
  }
  const retained = live || unknown;
  const ownership = live ? "live" : unknown ? "unknown" : "abandoned";
  assert.deepEqual(rows.slice(-3).map((row) => [row.data.phase, row.data.ownership]),
    [["ownership", ownership], [retained ? "retained" : "removed", ownership], ["completed", undefined]]);
  if (retained) {
    const ownerNames = expected.ownerNames;
    assert.ok(ownerNames, "a protected run must retain its owner records");
    assert.ok(ownerNames.includes(`owner-${expected.owner}.json`), "the original main owner must remain independently recorded");
    assert.deepEqual(ownerNames.slice(0, observations.length), [...seen]);
    if (!live) assert.equal(ownerNames.length, observations.length);
  } else {
    assert.ok(seen.has(`owner-${expected.owner}.json`), "every recognized owner, including the original main, must prove ESRCH");
    assert.equal(expected.ownerNames, undefined);
  }
  return retained;
}
