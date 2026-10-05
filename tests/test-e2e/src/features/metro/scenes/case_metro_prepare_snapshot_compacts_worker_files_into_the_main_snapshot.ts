import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import {
  listWorkerSnapshots,
  prepareSnapshot,
  readMainSnapshot,
  snapshotDirectory,
} from "../../../internal/metro/internal/metro-snapshot";

const { spawnSync } = E2eProcessTrace;

/**
 * Verifies snapshot compaction merges worker files into the main snapshot.
 *
 * Workers write uniquely named files to stay race-free; `withTtsc` compacts
 * them at the next config load. The files union must survive, the epoch id must
 * be preserved (compaction is maintenance, not an epoch change that would
 * spuriously invalidate every cache entry), and the worker files must be gone
 * afterwards.
 *
 * 1. Prepare a snapshot; note its id; drop a worker file recording a path.
 * 2. Prepare again.
 * 3. Assert the main snapshot keeps the id, contains the path, and no worker files
 *    remain.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual preparation rejects live lock ownership, recovers a proven-dead Node child lock and then compacts a valid worker into the unchanged main epoch with cleanup.
 * @evidence contracts/testing.md#independent-expectations The live current PID and actually exited child establish independent ownership facts; literal private-token grammar, retained worker and epoch equality require conservative recovery.
 * @evidence contracts/testing.md#distinguishing-cases Live owner contrasts proven-dead owner, followed by a new preparation that merges the retained valid worker.
 * @evidence contracts/testing.md#execution-ownership This legacy E2E scenario directly invokes the fingerprint owning operation; the actual Node child only prepares an exited PID, not a shipped host connection. Authored direct owner tests/test-metro/src/features/cache/test_prepare_snapshot_preserves_live_ownership_and_retires_a_dead_owner.ts preserves the mapped live/dead/quarantine matrix; its actual runtime survival remains unverified.
 * @evidence contracts/e2e.md#necessary-boundary Native PID liveness is a real input to this direct owning operation, not by itself an E2E justification. The existing direct unit retains actual exited PID and native ESRCH observation; synthetic PID or prefilled liveness must not replace them. Legacy selection stays until actual direct survival permits removal.
 * @evidence contracts/e2e.md#shared-execution One Node child prepares the dead PID and one bare directory serves original live/dead/merge rows; no compiler/consumer install is deliberately prepared. Direct-unit execution will retain that necessary PID setup cost instead of counting relocation as savings; parent calls do not count unrelated descendants.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The live lock cleanup retains an original assertion error if removal also fails. The owned child result checks error/status/signal/positive PID and actual ESRCH before dead-owner use. Workspace slot reset/parent cleanup owns retained worker/quarantine files; synchronous child return is not arbitrary descendant-join proof.
 * @evidence contracts/e2e.md#preserved-coverage Original live nonce/epoch/worker retention, dead nonce/fixedlock absence/quarantine, and final stable epoch/member/worker-empty assertions remain. Exact direct unit body and selection conditions are mapped, actual invocation/survival and legacy selection removal remain unverified; this does not certify the independent 150-round boundary.
 */
export async function case_metro_prepare_snapshot_compacts_worker_files_into_the_main_snapshot(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const root = MetroWorkspace.enterBare(workspace);
  await prepareSnapshot(root);
  const identity = readMainSnapshot(root).id;
  const recorded = path.join(root, "..", "somewhere", "external.d.ts");
  fs.writeFileSync(
    path.join(snapshotDirectory(root), "graph-inputs.worker-test.json"),
    JSON.stringify({
      files: [recorded],
      tainted: false,
      trees: [],
      accessibleEntries: [],
      version: 4,
      volatile: false,
    }),
    "utf8",
  );
  const compactionLock = path.join(
    snapshotDirectory(root),
    "snapshot-compaction.lock",
  );
  fs.mkdirSync(compactionLock);
  fs.writeFileSync(
    path.join(compactionLock, "owner.json"),
    JSON.stringify({ pid: process.pid, token: "1".repeat(32) }),
    "utf8",
  );
  const liveFailures: unknown[] = [];
  try {
    assert.match(
      await prepareSnapshot(root),
      /^nonce:[a-f0-9]{32}$/,
      "a concurrent compactor must force this run onto a private key",
    );
    assert.equal(
      readMainSnapshot(root).id,
      identity,
      "the contender must not rewrite the shared main snapshot",
    );
    assert.equal(
      listWorkerSnapshots(root).length,
      1,
      "the contender must leave the owner's pending worker document intact",
    );
  } catch (error) {
    liveFailures.push(error);
  } finally {
    try {
      fs.rmSync(compactionLock, { force: true, recursive: true });
    } catch (error) {
      liveFailures.push(error);
    }
  }
  if (liveFailures.length !== 0) {
    throw new AggregateError(
      liveFailures,
      "Live compactor observation or owned lock cleanup failed",
    );
  }

  const exited = spawnSync(process.execPath, ["-e", ""], { stdio: "ignore" });
  assert.equal(exited.error, undefined);
  assert.equal(exited.status, 0);
  assert.equal(exited.signal, null);
  assert.ok(Number.isSafeInteger(exited.pid) && exited.pid > 0);
  let absence: unknown;
  try {
    process.kill(exited.pid, 0);
  } catch (error) {
    absence = error;
  }
  assert.ok(
    typeof absence === "object" && absence !== null && "code" in absence,
  );
  assert.equal(
    absence.code,
    "ESRCH",
    "only native absence establishes this owner is dead",
  );
  const staleToken = "2".repeat(32);
  fs.mkdirSync(compactionLock);
  fs.writeFileSync(
    path.join(compactionLock, "owner.json"),
    JSON.stringify({ pid: exited.pid, token: staleToken }),
    "utf8",
  );
  assert.match(
    await prepareSnapshot(root),
    /^nonce:[a-f0-9]{32}$/,
    "the run that discovers a dead compactor must remain private",
  );
  assert.equal(
    fs.existsSync(compactionLock),
    false,
    "a proven dead owner's lock must be moved away from the shared name",
  );
  assert.equal(
    fs.existsSync(
      path.join(
        snapshotDirectory(root),
        `.snapshot-compaction-stale-${staleToken}`,
      ),
    ),
    true,
    "dead-owner recovery must retain an election record for delayed contenders",
  );
  assert.equal(
    listWorkerSnapshots(root).length,
    1,
    "dead-owner recovery must leave compaction to the next run",
  );
  await prepareSnapshot(root);
  const main = readMainSnapshot(root);
  assert.equal(main.id, identity);
  assert.ok(main.files.includes(recorded));
  assert.deepEqual(listWorkerSnapshots(root), []);
}
