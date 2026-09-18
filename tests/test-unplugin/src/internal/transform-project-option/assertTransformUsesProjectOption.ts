import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { writeUnpluginProject } from "./writeUnpluginProject";

/**
 * Asserts that `transformTtsc` uses an explicit absolute `project` path instead
 * of auto-discovering `tsconfig.json`, allowing the adapter to point at a
 * bundler-specific tsconfig.
 */
export async function assertTransformUsesProjectOption() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  writeUnpluginProject(root);

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      project: path.join(root, "tsconfig.unplugin.json"),
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
