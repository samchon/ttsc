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
