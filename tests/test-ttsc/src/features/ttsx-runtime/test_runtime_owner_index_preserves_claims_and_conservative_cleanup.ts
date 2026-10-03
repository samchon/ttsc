import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ProcessOwnedDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/ProcessOwnedDirectory";
import { claimRuntimeProjectDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/claimRuntimeProjectDirectory";
import { resolveRuntimeCleanTargets } from "../../../../../packages/ttsc/src/launcher/internal/runtime/resolveRuntimeCleanTargets";
import { runtimeRunKey } from "../../../../../packages/ttsc/src/launcher/internal/runtime/runtimeRunKey";
import { withRuntimeDirectoryLock } from "../../../../../packages/ttsc/src/launcher/internal/runtime/withRuntimeDirectoryLock";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies runtime claims preserve other runs and conservative owner evidence.
 *
 * A pid does not identify a run across hosts. The nonce-bearing claim must keep
 * a remote run with this process's pid intact. Missing and malformed records
 * likewise provide no authority to sweep or clean a run. Relinquishment removes
 * only the selected claim; another owner still protects the directory.
 *
 * 1. Author legacy, malformed, pid-mismatched, remote and live owner cases.
 * 2. Admit and relinquish a local claim beside an independently authored remote
 *    owner, preserving that owner's record and content.
 * 3. Claim a nonce-bearing run under the real runtime lock, then sweep and plan
 *    clean over the same index without removing any protected run.
 *
 * No compiler, loader or worker executes. Authored owner records establish
 * grammar and conservative policy; the current pid is a genuinely live owner.
 * This does not prove dead-process reclamation, process-exit cleanup,
 * concurrent admission, or the compiler/loader assembly retained by the runtime
 * corpus.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ProcessOwnedDirectory admission, ownership, relinquishment and sweep plus claimRuntimeProjectDirectory/runtimeRunKey and resolveRuntimeCleanTargets preserve authored protected directories and publish a distinct live claim under the default real lock.
 * @evidence contracts/testing.md#independent-expectations Literal state labels, record bytes, sentinel contents, an empty clean target list and the separately authored pid-only directory establish expectations; observed claim or cleanup output never supplies an expected snapshot.
 * @evidence contracts/testing.md#distinguishing-cases Legacy absence, corrupt JSON, filename/payload pid mismatch, remote same-pid ownership, mixed uncertain/live evidence and local release with a remaining remote owner contrast with a freshly published local claim. No fabricated dead pid or native compiler observation is supplied.
 * @evidence contracts/testing.md#execution-ownership One tracked physical filesystem root owns every matrix entry. Supported production operations retain their default lock and filesystem/liveness behavior, without foreign replacements, private inspection, child processes or an installed consumer. Every assertion group is collected before failure, and finally relinquishes the successful claim under its real lock.
 */
export function test_runtime_owner_index_preserves_claims_and_conservative_cleanup(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("runtime-owner-policy-"),
  );
  const cache = path.join(root, "cache");
  const runtime = path.join(cache, "ttsx");
  const runs = path.join(runtime, "project");
  fs.mkdirSync(runs, { recursive: true });
  const failures: Error[] = [];
  const check = (identity: string, verify: () => void): void => {
    try {
      verify();
    } catch (cause) {
      failures.push(new Error(identity, { cause }));
    }
  };
  const pid = process.pid;
  const record = `owner-${pid}.json`;
  const remoteRecord = JSON.stringify({
    hostname: `${os.hostname()}-elsewhere`,
    pid,
  });
  const legacy = path.join(runs, "legacy");
  const malformed = path.join(runs, "malformed");
  const mismatch = path.join(runs, "pid-mismatch");
  const remote = path.join(runs, String(pid));
  const mixed = path.join(runs, "mixed-live-and-unknown");
  const shared = path.join(runs, "shared");
  for (const directory of [
    legacy,
    malformed,
    mismatch,
    remote,
    mixed,
    shared,
  ]) {
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "in-use.txt"), "preserved", "utf8");
  }
  fs.writeFileSync(path.join(malformed, record), "{", "utf8");
  fs.writeFileSync(
    path.join(mismatch, record),
    JSON.stringify({ hostname: os.hostname(), pid: pid + 1 }),
    "utf8",
  );
  fs.writeFileSync(path.join(remote, record), remoteRecord, "utf8");
  fs.writeFileSync(path.join(mixed, "owner-uncertain.json"), "{", "utf8");
  ProcessOwnedDirectory.admit(mixed, pid);
  ProcessOwnedDirectory.admit(shared, pid);
  const otherRecord = `owner-${pid + 1}.json`;
  const otherBytes = JSON.stringify({
    hostname: `${os.hostname()}-elsewhere`,
    pid: pid + 1,
  });
  fs.writeFileSync(path.join(shared, otherRecord), otherBytes, "utf8");
  let claimed: string | undefined;
  try {
    for (const [identity, directory, expected] of [
      ["legacy owner absence", legacy, "unowned"],
      ["malformed owner", malformed, "unknown"],
      ["owner filename/payload mismatch", mismatch, "unknown"],
      ["remote run sharing the local pid", remote, "live"],
      ["live owner wins beside uncertain evidence", mixed, "live"],
      ["local and remote owners", shared, "live"],
    ] as const) {
      check(identity, () =>
        assert.equal(ProcessOwnedDirectory.ownership(directory), expected),
      );
    }
    withRuntimeDirectoryLock(runtime, () =>
      ProcessOwnedDirectory.relinquish(shared),
    );
    check("release preserves another owner", () => {
      assert.equal(fs.existsSync(path.join(shared, record)), false);
      assert.equal(
        fs.readFileSync(path.join(shared, otherRecord), "utf8"),
        otherBytes,
      );
      assert.equal(
        fs.readFileSync(path.join(shared, "in-use.txt"), "utf8"),
        "preserved",
      );
      assert.equal(ProcessOwnedDirectory.ownership(shared), "live");
    });
    const key = runtimeRunKey();
    check("same-process nonce identity", () => {
      assert.match(key, new RegExp(`^${pid}-[0-9a-f]{16}$`));
      assert.equal(runtimeRunKey(), key);
      assert.notEqual(key, String(pid));
    });
    try {
      claimed = claimRuntimeProjectDirectory(runtime, key);
    } catch (cause) {
      failures.push(new Error("real locked claim", { cause }));
    }
    check("claim does not replace the remote pid-only run", () => {
      assert.equal(
        fs.readFileSync(path.join(remote, "in-use.txt"), "utf8"),
        "preserved",
      );
      assert.equal(
        fs.readFileSync(path.join(remote, record), "utf8"),
        remoteRecord,
      );
      assert.ok(claimed !== undefined, "claim must succeed");
      assert.equal(claimed, path.join(fs.realpathSync.native(runs), key));
      assert.notEqual(claimed, remote);
      assert.equal(ProcessOwnedDirectory.ownership(claimed), "live");
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(claimed, record), "utf8")),
        { hostname: os.hostname(), pid },
      );
    });
    withRuntimeDirectoryLock(runtime, () => ProcessOwnedDirectory.sweep(runs));
    check("sweep preserves every authored protected run", () => {
      for (const directory of [
        legacy,
        malformed,
        mismatch,
        remote,
        mixed,
        shared,
      ]) {
        assert.equal(
          fs.readFileSync(path.join(directory, "in-use.txt"), "utf8"),
          "preserved",
        );
      }
    });
    check("clean selects no protected run", () => {
      const plan = withRuntimeDirectoryLock(runtime, () =>
        resolveRuntimeCleanTargets(cache),
      );
      assert.deepEqual(plan.targets, []);
      assert.deepEqual(
        [...plan.kept].sort(),
        [
          legacy,
          malformed,
          mismatch,
          remote,
          mixed,
          shared,
          ...(claimed === undefined ? [] : [claimed]),
        ]
          .map((directory) => fs.realpathSync.native(directory))
          .sort(),
      );
    });
  } finally {
    if (claimed !== undefined) {
      const ownedClaim = claimed;
      try {
        withRuntimeDirectoryLock(runtime, () =>
          ProcessOwnedDirectory.relinquish(ownedClaim),
        );
      } catch (cause) {
        failures.push(new Error("claim relinquishment", { cause }));
      }
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "runtime owner/index matrix failed");
}
