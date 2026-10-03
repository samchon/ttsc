import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { processPluginBuildEnvironment } from "ttsc/plugin-source";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/TtscHostInputValidation";
import { matchesUniversalHostInputTrees } from "../../../../../packages/unplugin/src/core/transform/validation/matchesUniversalHostInputTrees";

/**
 * Verifies a silent source tracker cannot certify an external build environment
 * different from the one under which its tree was last proven.
 *
 * An impossible recorded tree-state literal makes fallback proof observable.
 * Qualified silence may skip source files under the current environment, but
 * must replay that same state when the external environment label differs.
 *
 * 1. Copy the original native Go source fixture and supply a silent tracker.
 * 2. Record the actual current environment label and require source skip.
 * 3. Substitute another-environment and require the wrong tree state to fail.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual matchesUniversalHostInputTrees with identical source/tracker and wrong tree-state literal. Current native environment permits the documented skip; another-environment requires reproof and literal false.
 * @evidence contracts/testing.md#independent-expectations The source watch boundary covers files rather than external toolchain state. The independent impossible a-state-the-directory-does-not-hold literal detects reproof; true/false expectations do not derive from the validator. Actual provider label supplies setup only, not a digest-format oracle.
 * @evidence contracts/testing.md#distinguishing-cases Same versus different recorded environment is the only changed input, preserving silent coverage and source bytes. Capture/validation race entries own environment movement during proof; no actual watcher or toolchain replacement is claimed here.
 * @evidence contracts/testing.md#execution-ownership This discoverable direct unit uses the original package-owned fixture bytes, actual processPluginBuildEnvironment and authored comparator tracker fields. Go env/version/GOROOT are owning inputs; no compiler/plugin artifact, native watcher, installed consumer or host executes. The tracker shape does not certify native delivery capability.
 */
export async function test_silent_plugin_source_tracker_proves_nothing_once_the_environment_moved(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-silent-tree-"),
  );
  TestProject.copyDirectory(path.join(TestProject.WORKSPACE_ROOT, "packages/unplugin/test/fixtures/e2e/silent_plugin_source_tracker_proves_nothing_once_the_environment_moved/inputs-1"), root);
  const source = path.join(root, "plugin");
  const result = { type: "success", typescript: {} };
  TRANSFORM_RESULT_FILESYSTEM.set(
    result as never,
    DEFAULT_FILESYSTEM_OPERATIONS,
  );
  const tracker: TtscProjectMutationTracker = {
    changes: new Set(),
    changesOmitted: false,
    close: () => undefined,
    contentAuthoritative: true,
    covered: new Set([source]),
    failed: false,
    membershipChanged: false,
  };
  const cached = {
    hostInputMutationTracker: tracker,
    result,
  } as unknown as TtscCachedProjectTransform;
  const validation = (environment: string): TtscHostInputValidation => ({
    covered: new Set([source]),
    entries: new Map(),
    missing: new Map(),
    treeEnvironments: new Map([[source, environment]]),
    trees: new Map([[source, "a-state-the-directory-does-not-hold"]]),
  });

  assert.equal(
    matchesUniversalHostInputTrees(
      cached,
      validation(processPluginBuildEnvironment(source)),
    ),
    true,
    "a silent tree under the same environment is skipped",
  );
  assert.equal(
    matchesUniversalHostInputTrees(cached, validation("another-environment")),
    false,
    "a silent tree under another environment is proven, and fails",
  );
}
