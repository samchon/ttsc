import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies the first delivery of each module in a pass does not re-read the
 * whole project.
 *
 * A project transform already returns output and an input snapshot for every
 * module. Re-hashing all P project files before selecting each of N outputs
 * makes the first build O(N x P), although no generation has crossed a build
 * boundary. The cache compares each supplied module source with its snapshot
 * entry instead, and keeps complete validation for a repeated request.
 *
 * 1. Open a pass over a 24-module project and deliver the first module.
 * 2. Change an input that complete validation would see.
 * 3. Deliver every other module once and assert the project compiled once.
 *
 * @evidence contracts/testing.md#behavioral-verification A 24-module pass delivers one module, edits the universal plugin descriptor, then delivers every remaining module once from their original source map. Every result must exist and the native run log must contain one capture, catching repeated complete-validation before sibling first delivery.
 * @evidence contracts/testing.md#independent-expectations The pass contract allows first module deliveries to use the captured source snapshot; a descriptor edit would force another capture if full validation ran. Independent run-log bytes and literal one-count indirectly detect that expensive path. Filesystem reads themselves are not counted, so harmless redundant reads remain outside the oracle.
 * @evidence contracts/testing.md#distinguishing-cases First delivery of each distinct sibling contrasts with repeated delivery of the same module, owned by its separate revalidation entry. The source map intentionally remains fixed while a universal input changes within the pass.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_avoids_rehashing_the_project_for_each_first_module_delivery in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built public transform API launches the counting native sidecar and consumes its graph through a real filesystem cache across delivery-pass boundaries. This pins process-envelope delivery and generation reuse rather than native type semantics; the real-native-envelope entries own compiler calibration.
 * @evidence contracts/e2e.md#shared-execution One 24-file createCacheProject and shared sidecar artifact provide all outputs in one capture through one build-scoped cache. Authored sources are read once into the case map; no per-module native preparation is necessary.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique root/log and per-entry source map isolate the descriptor append. One explicit pass boundary precedes all deliveries, preserving first-delivery identities. No explicit cache reset occurs here; build-pass resources and TestProject paths end with the runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_avoids_rehashing_the_project_for_each_first_module_delivery; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_avoids_rehashing_the_project_for_each_first_module_delivery(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 24 });
  const modules = projectModules(project.root);
  const sources = new Map(
    modules.map((file) => [file, fs.readFileSync(file, "utf8")]),
  );
  const cache = createTtscTransformCache();
  beginTtscTransformBuild(cache);
  const options = resolveOptions();

  const first = modules[0]!;
  assert.ok(
    await transformTtsc(first, sources.get(first)!, options, undefined, cache),
  );

  fs.appendFileSync(
    path.join(project.root, "plugin.cjs"),
    "\n// changed after the build-scoped generation started\n",
    "utf8",
  );
  for (const file of modules.slice(1)) {
    assert.ok(
      await transformTtsc(file, sources.get(file)!, options, undefined, cache),
    );
  }

  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
}
