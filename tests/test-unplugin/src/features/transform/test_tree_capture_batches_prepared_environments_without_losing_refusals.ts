import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  pluginSourceState,
  processPluginBuildEnvironment,
} from "ttsc/plugin-source";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { preparePluginBuildEnvironments } from "../../../../../packages/unplugin/src/core/transform/inputs/preparePluginBuildEnvironments";
import { captureUniversalHostInputValidation } from "../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies prepared plugin trees retain their individual authority while
 * sharing current environment observations during synchronous capture.
 *
 * Several plugin directories commonly use one SDK. Sharing native queries must
 * still refuse a changed or missing source.
 *
 * 1. Copy two native plugin inputs and prepare their actual source/environment
 *    states without building a plugin or starting a compiler.
 * 2. Capture both trees and require each independently observed environment.
 * 3. Edit and remove one source while the other remains valid, requiring refusal,
 *    then restore the actual bytes and require recovery.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises actual preparePluginBuildEnvironments and captureUniversalHostInputValidation over two native source trees. It asserts complete manifest coverage and each actual prepared environment, then no admitted manifest and the changed directory's classified failure after authored edits and removal.
 * @evidence contracts/testing.md#independent-expectations Authored source edits and removal determine invalidity independently of implementation hashes. Actual environment readings provide input labels, not expected output snapshots; byte restoration establishes the recovery state. Native digest-format correctness and query counts are outside this oracle.
 * @evidence contracts/testing.md#distinguishing-cases Covers multiple prepared directories, unchanged acceptance, one changed tree beside a stable sibling, missing sources and actual restoration. Existing moving-environment capture/validation cases own environment changes during a proof; case_unproven_plugin_source_is_rejected_after_native_preparation owns the initially unprepared missing source and cold worker transport.
 * @evidence contracts/testing.md#execution-ownership This discoverable unit calls authored source directly and copies a suite-owned static native input without compiling it, installing a consumer or starting a host. No globals or foreign methods are replaced; finally removes its isolated native root.
 */
export async function test_tree_capture_batches_prepared_environments_without_losing_refusals(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-batched-tree-capture-");
  const fixture = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages/unplugin/test/fixtures/e2e/createMovingEnvironmentFixture/inputs-1/plugin",
  );
  const first = path.join(root, "first");
  const second = path.join(root, "second");
  TestProject.copyDirectory(fixture, first);
  TestProject.copyDirectory(fixture, second);
  const secondMain = path.join(second, "main.go");
  const original = fs.readFileSync(secondMain);
  try {
    const firstEnvironment = processPluginBuildEnvironment(first, false, root);
    const secondEnvironment = processPluginBuildEnvironment(
      second,
      false,
      root,
    );
    const result = {
      type: "success" as const,
      typescript: {},
      pluginSources: {
        [first]: pluginSourceState(first, {
          environment: firstEnvironment,
          projectRoot: root,
        }),
        [second]: pluginSourceState(second, {
          environment: secondEnvironment,
          projectRoot: root,
        }),
      },
    } as TtscCachedProjectTransform["result"];
    TRANSFORM_RESULT_FILESYSTEM.set(result, DEFAULT_FILESYSTEM_OPERATIONS);
    await preparePluginBuildEnvironments(
      result,
      DEFAULT_FILESYSTEM_OPERATIONS,
      undefined,
      root,
    );
    const cached = { projectRoot: root, result } as TtscCachedProjectTransform;
    const capture = () =>
      captureUniversalHostInputValidation(cached, path.join(root, "entry.ts"));
    const accepted = capture();
    assert.equal(accepted.failures.entries.length, 0);
    assert.deepEqual([...accepted.validation!.trees.keys()], [first, second]);
    assert.equal(
      accepted.validation!.treeEnvironments!.get(first),
      firstEnvironment,
    );
    assert.equal(
      accepted.validation!.treeEnvironments!.get(second),
      secondEnvironment,
    );

    fs.appendFileSync(secondMain, "// actual source edit\n");
    const edited = capture();
    assert.equal(edited.validation, undefined);
    assert.ok(
      edited.failures.entries.some(
        (failure) =>
          failure.path === second && failure.kind === "content-changed",
      ),
    );
    fs.rmSync(secondMain);
    assert.equal(capture().validation, undefined);
    fs.writeFileSync(secondMain, original);
    assert.ok(
      capture().validation,
      "actual restoration must recover authority",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
