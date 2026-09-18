import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { writeUnpluginProject } from "./writeUnpluginProject";

/**
 * Asserts that a relative `project` path in `resolveOptions` is resolved
 * against `process.cwd()`, not the file being transformed.
 *
 * Temporarily changes `process.cwd()` to the project root and restores it in a
 * `finally` block to avoid polluting subsequent tests.
 */
export async function assertTransformUsesRelativeProjectOption() {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  writeUnpluginProject(root);

  const cwd = process.cwd();
  process.chdir(root);
  try {
    const result = await transformTtsc(
      TestUnpluginProject.mainFile(root),
      TestUnpluginProject.mainSource(root),
      resolveOptions({
        project: "tsconfig.unplugin.json",
      }),
    );

    assert.ok(result);
    assert.match(result.code, /"PLUGIN"/);
  } finally {
    process.chdir(cwd);
  }
}
