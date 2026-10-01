import assert from "node:assert/strict";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM.mjs";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/lib/core/transform/validation/TtscHostInputValidation.mjs";
import { matchesUniversalHostInputTrees } from "../../../../../packages/unplugin/lib/core/transform/validation/matchesUniversalHostInputTrees.mjs";
import { createMovingEnvironmentFixture } from "../../internal/moving-environment/createMovingEnvironmentFixture";

/**
 * Verifies a delivery's plugin source proof records the environment reading it
 * started from, so an environment that moved during the proof is proven again.
 *
 * A delivery skips a plugin source tree its tracker heard nothing below while
 * the recorded environment is this process's reading (samchon/ttsc#1516).
 * Recording a reading taken after the proof would record a move that landed
 * during it as proven, and the next delivery would skip a tree it never proved
 * under that environment (samchon/ttsc#1522). Nothing pinned the order
 * (samchon/ttsc#1565).
 *
 * 1. Validate a tree through a filesystem whose first metadata read below it moves
 *    the Go environment, with the tree's state under the moved one.
 * 2. Assert the proof held and recorded the reading from before the move.
 * 3. Validate again with a tracker that heard nothing, and assert the tree was
 *    read again rather than skipped.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls matchesUniversalHostInputTrees twice while first source metadata access changes GOENV; asserts successful proof records the pre-move label and the next silent validation reads the source again.
 * @evidence contracts/testing.md#independent-expectations A proof starting under one environment cannot retroactively certify a move arriving during it. Before/moved fixture labels and the injected write determine the expected label independently of recording order; nonzero reads detect a stale skip.
 * @evidence contracts/testing.md#distinguishing-cases Owns an environment race during revalidation, followed by silent next validation. The capture sibling owns initialization of a fresh manifest under the same race.
 * @evidence contracts/testing.md#execution-ownership E2E entry uses built tree validation and real Go environment discovery over a privately rewritten GOENV file. Trackers and metadata timing are controlled; no watcher or plugin compiler is started.
 * @evidence contracts/e2e.md#necessary-boundary The real environment-file/provider connection makes a move during source proof visible across adapter and ttsc state ownership. The recording decision is portable, but without an isolated provider seam the scenario remains mixed integration.
 * @evidence contracts/e2e.md#shared-execution One source fixture and its two prepared environment labels serve both validations. Existing packages/toolchain are shared; a changed GOENV causes the necessary new provider reading instead of a per-case binary build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the first metadata access mutates the fixture environment; resetReads preserves the moved state while zeroing counts. dispose restores GOENV in finally and TestProject removes temporary roots at process exit; case-local maps cannot leak an accepted tree to another entry.
 * @evidence contracts/e2e.md#preserved-coverage Both successful validations, the pre-proof label and the second read-count assertion remain unchanged. Pure recording-order coverage remains coupled to provider integration rather than being claimed as transferred unit coverage.
 */
export function test_tree_validation_records_the_environment_its_proof_started_from(): void {
  const fixture = createMovingEnvironmentFixture();
  try {
    assert.notEqual(fixture.moved, fixture.before, "GOENV moved nothing");
    const result = { type: "success", typescript: {} };
    TRANSFORM_RESULT_FILESYSTEM.set(result as never, fixture.filesystem);
    const tracker: TtscProjectMutationTracker = {
      changes: new Set(),
      changesOmitted: false,
      close: () => undefined,
      contentAuthoritative: true,
      covered: new Set([fixture.source]),
      failed: false,
      membershipChanged: false,
    };
    const cached = {
      hostInputMutationTracker: tracker,
      result,
    } as unknown as TtscCachedProjectTransform;
    const validation: TtscHostInputValidation = {
      covered: new Set([fixture.source]),
      entries: new Map(),
      missing: new Map(),
      trees: new Map([[fixture.source, fixture.movedState]]),
    };

    assert.equal(matchesUniversalHostInputTrees(cached, validation), true);
    assert.equal(
      validation.treeEnvironments?.get(fixture.source),
      fixture.before,
      "the recorded environment is one the proof did not start from",
    );

    fixture.resetReads();
    assert.equal(matchesUniversalHostInputTrees(cached, validation), true);
    assert.ok(
      fixture.reads() > 0,
      "a silent tree was skipped under an environment it was not proven under",
    );
  } finally {
    fixture.dispose();
  }
}
