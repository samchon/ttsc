import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { matchesUniversalHostInputTrees } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputTrees";
import { createMovingEnvironmentUnitFixture } from "../../internal/transform-project-cache/createMovingEnvironmentUnitFixture";

/**
 * Verifies tree capture records the environment its proof started under,
 * so a move during proof requires a later silent delivery to reprove the tree.
 *
 * The first supplied source metadata read writes a private GOENV file. Actual
 * native provider labels establish before/moved values; the result contains
 * literal moved source state, allowing proof while preserving the older label.
 *
 * 1. Prepare distinct native before/moved readings and a moved-state envelope.
 * 2. Capture through the first-read environment move and require successful
 *    tree admission with the independently observed before label.
 * 3. Reset only metadata-read counts and require a later successful validation
 *    to read again despite identical silent source coverage.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual captureUniversalHostInputValidation then matchesUniversalHostInputTrees. Capture must succeed and record before, not moved; subsequent validation must succeed with a positive source metadata-read count rather than silently skipping.
 * @evidence contracts/testing.md#independent-expectations A proof cannot certify an environment arriving after its start. Private GOENV before/moved readings and first-read write independently establish ordering; a count greater than zero observes actual reproof, without requiring a product-derived exact scan count. Labels/state share the native provider, so digest-format correctness is outside this oracle.
 * @evidence contracts/testing.md#distinguishing-cases Distinct labels are asserted before capture. Successful admission contrasts with the forbidden post-move label; next-delivery positive reads distinguish reproof from a stale quiet skip. The sibling validation entry owns the same movement during existing-manifest proof. Fixture catch and finally dispose restore exact GOENV and GOFLAGS absence/values.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct unit and suite-owned moving fixture copy the original four source/project files without changing bytes and preserve native Go environment inputs. Authored envelope/tracker fields are capture arguments, not evidence that a compiler produced them. No compiler/plugin binary, watcher, installed consumer or product host runs; E2E donor is retained.
 */
export function test_tree_capture_records_the_environment_its_proof_started_from(): void {
  const fixture = createMovingEnvironmentUnitFixture();
  try {
    assert.notEqual(fixture.moved, fixture.before, "GOENV moved nothing");
    const result = {
      type: "success",
      typescript: {},
      pluginSources: { [fixture.source]: fixture.movedState },
    };
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
      projectRoot: fixture.project,
      result,
      scratchDirectory: TestProject.tmpdir("ttsc-unplugin-moving-scratch-"),
      temporaryTsconfig: undefined,
    } as unknown as TtscCachedProjectTransform;

    const { validation } = captureUniversalHostInputValidation(
      cached,
      path.join(fixture.project, "src", "index.ts"),
    );
    assert.ok(validation, "the capture refused a tree that holds");
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
