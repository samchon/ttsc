import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { TestFailureLedger } from "../../../../../utils/src/TestFailureLedger";
import { TestLifetime } from "../../../../../utils/src/TestLifetime";
import { OwnedE2eEntry } from "../../../batch/OwnedE2eEntry";

/**
 * Verifies config recovery completes under its original native owner.
 *
 * A callback that never arrives must fail this prepared test rather than keep
 * the batch waiting. The original scene retains its deletion, recreation,
 * atomic replacement and ordinary-write assertions; only a real native
 * retirement receipt permits fixture reclamation.
 *
 * 1. Lend one private root to the original config-recovery scene.
 * 2. Await that scene and its original native boundary under an explicit failure
 *    budget.
 * 3. Preserve failure and reclaim only after joined or never-admitted retirement.
 *
 * @evidence contracts/testing.md#behavioral-verification The static actor invokes the original scene's actual WatchTopology and compiler observations; the parent requires ordinary status zero and native joined retirement. Budget expiry remains a failed verdict even when original native cancellation joins.
 * @evidence contracts/testing.md#independent-expectations The original config bytes and callback-count assertions define recovery independently of timing. Native retirement classification governs release; the explicit 120-second budget is failure policy, never a correctness or readiness oracle.
 * @evidence contracts/testing.md#distinguishing-cases Retains deletion with parse failure, recreation, atomic replacement and ordinary edit. Missing callbacks or stalled startup/cleanup are failed observations; unknown native retirement retains the same input root. Existing lifetime units and native carrier controls own expiry, pre-abort, cancellation and ordinary-exit mechanics.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch retains this named entry, which runs one static Node actor through the existing built native helper. The child owns the unchanged real topology sequence; portable deadline policy remains in test-graph units.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler membership and native subscriptions must deliver the original config callbacks, while independent native containment supervises synchronous startup and cleanup that a same-thread timer cannot interrupt.
 * @evidence contracts/e2e.md#shared-execution One new Node actor and one existing native helper contain the original scene, without an installation, Go producer or duplicated compiler population. The incomplete CI trace recorded four successful inner compiler listings, without a scene-completion receipt; callback scheduling still determines actual listing count.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity An exclusive parent root scopes the child's TEMP/TMP/TMPDIR through its initial environment. Its original native receipt and captured root identity precede reclamation; unknown retirement or replacement retains the exact allocation. The same parent deadline caps the child's budget and ends only after native joining and parent cleanup.
 * @evidence contracts/e2e.md#preserved-coverage The scene retains every original input, mutation order, positive assertion and 250-ms quiet observation. Its exported scene is invoked by the static actor without duplicating it in the batch; termination or elapsed time cannot pass the assertions.
 */
export async function test_watch_topology_reports_deleted_config_and_recreation(): Promise<void> {
  const owner = new TestLifetime({
    name: "contained config-recovery",
    timeoutMs: 120_000,
  });
  let root: string | undefined;
  let identity: { dev: bigint; ino: bigint; realpath: string } | undefined;
  let retirement: "joined" | "not-started" | "unknown" = "not-started";
  let observed = false;
  const failures = new TestFailureLedger();
  try {
    owner.checkpoint("fixture startup");
    root = TestProject.tmpdir("ttsc-config-recovery-owner-");
    const stat = fs.lstatSync(root, { bigint: true });
    identity = {
      dev: stat.dev,
      ino: stat.ino,
      realpath: fs.realpathSync.native(root),
    };
    owner.assertActive();
    owner.checkpoint("original config-recovery actor and native join");
    retirement = "unknown";
    const result = await OwnedE2eEntry.run({
      entry: path.join(
        TestProject.WORKSPACE_ROOT,
        "tests/test-e2e/fixtures/ttsc/watch-config-recovery/actor.mjs",
      ),
      args: [
        pathToFileURL(
          path.resolve(
            import.meta.dirname,
            "../scenes/case_watch_topology_reports_deleted_config_and_recreation.ts",
          ),
        ).href,
        String(owner.deadline),
      ],
      env: { ...process.env, TEMP: root, TMP: root, TMPDIR: root },
      signal: owner.signal,
      observeRetirement: (state) => {
        observed = true;
        retirement = state;
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(
      result.status,
      0,
      "original config-recovery scene must finish its assertions",
    );
    assert.equal(
      retirement,
      "joined",
      "original native owner must certify retirement",
    );
  } catch (error) {
    // The native API's pre-admission abort preserves the exact reason and calls
    // no retirement observer. Every other unobserved lifetime stays unknown.
    if (!observed && owner.signal.aborted && error === owner.signal.reason)
      retirement = "not-started";
    failures.add(error);
  } finally {
    owner.checkpoint("original fixture release");
    if (root !== undefined) {
      try {
        if (retirement === "unknown")
          TestProject.retainTemporaryDirectory(
            root,
            "config-recovery native retirement is unknown",
          );
        else {
          const current = fs.lstatSync(root, { bigint: true });
          assert.deepEqual(
            {
              dev: current.dev,
              ino: current.ino,
              realpath: fs.realpathSync.native(root),
            },
            identity,
            "original config-recovery root identity must survive until release",
          );
          fs.rmSync(root, { recursive: true });
        }
      } catch (error) {
        failures.add(error);
        try {
          TestProject.retainTemporaryDirectory(
            root,
            "config-recovery fixture reclamation failed",
          );
        } catch (retention) {
          failures.add(retention);
        }
      }
    }
    for (const failure of owner.finish()) failures.add(failure);
  }
  failures.throwIfFailed(
    "config-recovery execution, native retirement and fixture release failed",
  );
}
