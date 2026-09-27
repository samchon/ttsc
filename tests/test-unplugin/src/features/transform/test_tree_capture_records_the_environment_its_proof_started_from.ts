import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM.mjs";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/lib/core/transform/validation/captureUniversalHostInputValidation.mjs";
import { matchesUniversalHostInputTrees } from "../../../../../packages/unplugin/lib/core/transform/validation/matchesUniversalHostInputTrees.mjs";
import { createMovingEnvironmentFixture } from "../../internal/moving-environment/createMovingEnvironmentFixture";

/**
 * Verifies a fresh generation's capture records, beside each plugin source tree
 * it proved, the environment reading its proof started from.
 *
 * The capture proves a generation's plugin sources before narrow reuse may
 * trust them, and a later delivery skips a silent tree while the recorded
 * environment is this process's reading (samchon/ttsc#1516). Recording a
 * reading taken after the proof would record a move that landed during it as
 * proven (samchon/ttsc#1522). Nothing pinned the order (samchon/ttsc#1565).
 *
 * 1. Capture a generation whose envelope names the tree with its state under the
 *    moved environment, through a filesystem whose first metadata read below
 *    the tree moves the Go environment.
 * 2. Assert the capture held and recorded the reading from before the move.
 * 3. Validate the captured manifest with a tracker that heard nothing, and assert
 *    the tree was read again rather than skipped.
 */
export function test_tree_capture_records_the_environment_its_proof_started_from(): void {
  const fixture = createMovingEnvironmentFixture();
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
