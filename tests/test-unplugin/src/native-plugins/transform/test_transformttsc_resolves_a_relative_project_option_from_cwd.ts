import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { writeUnpluginProject } from "../../internal/transform-project-option/writeUnpluginProject";

/**
 * Verifies a relative `project` option resolves against the working directory,
 * not the transformed file.
 *
 * `resolveOptions({ project })` follows the command-line compiler's convention:
 * a relative project path is relative to where the tool runs. Resolving it
 * against the module would pick a different config for every directory.
 *
 * 1. Write an alternate tsconfig at the project root.
 * 2. Change the working directory to the root and transform with `project:
 *    "tsconfig.unplugin.json"`.
 * 3. Assert the output is transformed, then restore the working directory.
 */
export async function test_transformttsc_resolves_a_relative_project_option_from_cwd(): Promise<void> {
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
