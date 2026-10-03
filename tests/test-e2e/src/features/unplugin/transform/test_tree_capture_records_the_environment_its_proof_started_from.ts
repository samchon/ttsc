import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM.mjs";
import type { TtscCachedProjectTransform } from "../../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import type { TtscProjectMutationTracker } from "../../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import { captureUniversalHostInputValidation } from "../../../../../../packages/unplugin/lib/core/transform/validation/captureUniversalHostInputValidation.mjs";
import { matchesUniversalHostInputTrees } from "../../../../../../packages/unplugin/lib/core/transform/validation/matchesUniversalHostInputTrees.mjs";
import { createMovingEnvironmentFixture } from "../../../internal/unplugin/internal/moving-environment/createMovingEnvironmentFixture";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Calls captureUniversalHostInputValidation then matchesUniversalHostInputTrees while the first source metadata read changes GOENV; asserts capture success, the pre-proof environment label and a later source reread despite silence.
 * @evidence contracts/testing.md#independent-expectations A proof can certify only the environment it started under. The fixture independently captures before/moved labels and injects the write at first metadata access; positive read count distinguishes reproof from a stale skip, though labels share the real environment provider.
 * @evidence contracts/testing.md#distinguishing-cases Owns capture-time environment movement and next-delivery reproof under a silent tracker. The delivery-validation sibling owns movement when revalidating an existing manifest.
 * @evidence contracts/testing.md#execution-ownership E2E entry invokes built capture and tree validation against the real Go environment file/provider with a metadata-read seam. It produces no plugin binary and opens no native watcher.
 * @evidence contracts/e2e.md#necessary-boundary An actual GOENV write must reach the external provider while adapter capture reads its source tree. That connection detects a stale provider reading; portable before/after recording is mixed here because the provider lacks a pure fixture injection.
 * @evidence contracts/e2e.md#shared-execution One moving-environment fixture prepares both labels and feeds capture plus subsequent validation. Toolchain installation/built packages are shared; changed GOENV genuinely needs a distinct environment read, without compiling native output.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture owns a private GOENV file, writes its move once at first source access, and resetReads clears only observation counts. dispose restores process.env.GOENV in finally; TestProject owns project/source/scratch cleanup at worker exit.
 * @evidence contracts/e2e.md#preserved-coverage Capture success, pre-move recorded environment and subsequent nonzero reads remain executable here. The portable order assertion has not been transferred to a provider-seamed unit; native source compilation is outside the case.
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
