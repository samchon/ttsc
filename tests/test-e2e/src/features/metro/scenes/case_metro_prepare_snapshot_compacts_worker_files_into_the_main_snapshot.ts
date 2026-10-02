import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const { spawnSync } = E2eProcessTrace;
import fs from "node:fs";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { prepareSnapshot, readMainSnapshot, listWorkerSnapshots, snapshotDirectory } from "../../../internal/metro/internal/metro-snapshot";

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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary Real process liveness determines lock recovery; a synthetic PID value cannot establish an owner has actually terminated.
 * @evidence contracts/e2e.md#shared-execution One trivial Node child supplies the dead-owner witness; all contention, recovery and merge observations share one prepared directory and start no native compiler or consumer installation. Its project is a slot of the experiment's single workspace, written or copied by MetroWorkspace instead of being created as a separate temporary directory.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The live lock is removed in finally and the dead child is synchronous/completed. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
 * @evidence contracts/e2e.md#preserved-coverage Live-contender nonce/no-rewrite, dead-owner nonce/retirement marker, worker retention and final epoch/membership/removal assertions all remain.
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
  } finally {
    fs.rmSync(compactionLock, { force: true, recursive: true });
  }

  const exited = spawnSync(process.execPath, ["-e", ""], { stdio: "ignore" });
  assert.equal(exited.status, 0);
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
