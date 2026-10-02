import assert from "node:assert/strict";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/TtscHostInputValidation";
import { matchesUniversalHostInputTrees } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputTrees";
import { createMovingEnvironmentUnitFixture } from "../../internal/transform-project-cache/createMovingEnvironmentUnitFixture";

/**
 * Verifies successful tree revalidation records its starting environment,
 * forcing a later silent validation to reprove a move arriving during proof.
 *
 * The native source state is prepared under the moved GOENV, but the actual
 * proof starts under before and moves on first source metadata access. A
 * successful comparison cannot retroactively certify the post-proof label.
 *
 * 1. Prepare distinct before/moved readings and record moved source state.
 * 2. Validate through the environment move and require true with before label.
 * 3. Reset only read counts and require another true with actual source reads.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual matchesUniversalHostInputTrees twice over an existing manifest. First success must record before; second success must perform source metadata reads instead of treating the move during the first proof as already certified.
 * @evidence contracts/testing.md#independent-expectations Private GOENV before/moved readings and one authored first-metadata write fix the event order independently of the validator. The expected older label and nonzero second reads follow that order, not a product-generated snapshot. Shared native provider state is setup, not an independent hash-format oracle.
 * @evidence contracts/testing.md#distinguishing-cases Before and moved must differ; first successful proof contrasts with forbidden moved labeling, then quiet tracker plus later current environment requires reproof. The capture sibling owns fresh-manifest admission. Fixture catch/finally restores exact GOENV and GOFLAGS absence/values and resetReads never rolls back the actual moved state.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct unit uses suite-owned native source/project bytes and actual Go environment observations as owning inputs, with supported metadata timing and authored manifest/tracker fields. It produces no compiler/plugin binary, native watcher, installed consumer or host and does not certify transported E2E authority.
 */
export function test_tree_validation_records_the_environment_its_proof_started_from(): void {
  const fixture = createMovingEnvironmentUnitFixture();
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
