import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { processPluginBuildEnvironment } from "ttsc/plugin-source";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM.mjs";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/lib/core/transform/cache/TtscCachedProjectTransform.mjs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.mjs";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/lib/core/transform/tracker/TtscProjectMutationTracker.mjs";
import type { TtscHostInputValidation } from "../../../../../packages/unplugin/lib/core/transform/validation/TtscHostInputValidation.mjs";
import { matchesUniversalHostInputTrees } from "../../../../../packages/unplugin/lib/core/transform/validation/matchesUniversalHostInputTrees.mjs";

/**
 * Verifies a silent tracker over a plugin source proves its files only, never
 * the build environment outside them.
 *
 * A delivery skipped a plugin source directory whenever its tracker heard
 * nothing below it. The Go toolchain the binary was built with lives outside
 * that directory, so a toolchain replaced in place kept the generation proven
 * (samchon/ttsc#1516). The skip now also requires the environment the tree was
 * last proven under to be this process's reading.
 *
 * 1. Give a generation a plugin source tree whose recorded state is wrong, and a
 *    tracker that covers the directory and heard nothing.
 * 2. Record the current environment as the one it was last proven under, and
 *    assert the silent tree is skipped.
 * 3. Record another environment, and assert the tree is proven again and fails.
 */
export async function test_silent_plugin_source_tracker_proves_nothing_once_the_environment_moved(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-silent-tree-"),
  );
  TestProject.writeFiles(root, {
    "plugin/go.mod": "module example.com/plugin\n\ngo 1.26\n",
    "plugin/main.go": "package main\n\nfunc main() {}\n",
  });
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
