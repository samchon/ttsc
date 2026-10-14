import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PluginBuildEnvironmentReadings } from "ttsc/plugin-source";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import {
  preparePluginBuildEnvironments,
  usesPreparedPluginBuildEnvironments,
} from "../../../../../../packages/unplugin/src/core/transform/inputs/preparePluginBuildEnvironments";
import { captureUniversalHostInputValidation } from "../../../../../../packages/unplugin/src/core/transform/validation/captureUniversalHostInputValidation";

/**
 * Verifies an unproven plugin source remains rejected after native environment
 * preparation.
 *
 * A new source-directory key has no cached environment reading, so preparation
 * crosses the real worker boundary. That reading can describe native failure
 * inputs for a nonexistent directory; it does not certify the producer's
 * unproven source-state label.
 *
 * 1. Select a private nonexistent plugin directory with no cached reading.
 * 2. Prepare through the built native-environment worker and retain asynchronous
 *    execution ownership.
 * 3. Capture its authored source-state label and require refusal without an
 *    admitted manifest.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual preparePluginBuildEnvironments attempts a new native environment reading and records async ownership. Capture then refuses the source-directory input and admits no manifest; the initial cache-only query proves this request starts without a prepared reading.
 * @evidence contracts/testing.md#independent-expectations The authored source-state label has no producer proof and its private directory does not exist. The required no-manifest verdict follows that missing source authority, independently of whether the environment reader returns a digest for native failure inputs.
 * @evidence contracts/testing.md#distinguishing-cases Preserves the missing-directory preparation and classified capture-refusal row moved from the batched-tree unit. That unit retains unchanged, edited, removed and restored native source rows; the explicit-precompilation scene owns real compiler overlap and teardown.
 * @evidence contracts/testing.md#execution-ownership The scenarios E2E entry imports this scene, which executes the authored adapter boundary against ttsc's built worker. It runs outside the unit population because cold native authority preparation owns a worker and native reader.
 * @evidence contracts/e2e.md#necessary-boundary Cold prepare-to-worker-to-capture assembly verifies native preparation cannot certify an unproven source-state label; a preseeded reading or callback-only unit cannot establish this connection.
 * @evidence contracts/e2e.md#shared-execution This scene uses the batch's existing built ttsc worker artifact and process-owned environment observer without installing a consumer, building another producer or starting a compiler. The unique missing directory preserves cold native preparation followed by missing-source refusal.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private directory spelling creates a distinct preparation key and starts with no reading; awaited preparation settles before capture and finally removes the private project root. The environment owner retains only its documented unreferenced process-owned worker and releases per-request transport listeners at settlement.
 * @evidence contracts/e2e.md#preserved-coverage This scene carries the original missing-directory preparation and capture refusal assertions into the E2E population while adding explicit initially-unprepared and asynchronous execution-ownership checks.
 */
export async function case_unproven_plugin_source_is_rejected_after_native_preparation(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-unproven-plugin-source-");
  const missing = path.join(root, "missing-source");
  const result = {
    type: "success" as const,
    typescript: {},
    pluginSources: { [missing]: "authored-unproven-state" },
  } as TtscCachedProjectTransform["result"];
  TRANSFORM_RESULT_FILESYSTEM.set(result, DEFAULT_FILESYSTEM_OPERATIONS);
  try {
    assert.equal(PluginBuildEnvironmentReadings.cached(missing), undefined);
    await preparePluginBuildEnvironments(
      result,
      DEFAULT_FILESYSTEM_OPERATIONS,
      undefined,
      root,
    );
    assert.equal(usesPreparedPluginBuildEnvironments(result), true);
    const refused = captureUniversalHostInputValidation(
      { projectRoot: root, result } as TtscCachedProjectTransform,
      path.join(root, "entry.ts"),
    );
    assert.equal(refused.validation, undefined);
    assert.ok(
      refused.failures.entries.some(
        (failure) =>
          failure.path === missing && failure.kind === "content-changed",
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
