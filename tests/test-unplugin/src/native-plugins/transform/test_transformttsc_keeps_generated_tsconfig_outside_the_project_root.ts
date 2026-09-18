import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the generated tsconfig is written outside the project root.
 *
 * A file written into the project would appear in the walk, change the
 * membership digest, and invalidate the generation it belongs to, as well as
 * clutter the user's tree.
 *
 * 1. Create a project with no configured plugins.
 * 2. Transform through the fixture's `assert-temp-tsconfig-outside-project`
 *    operation.
 * 3. Assert the transform succeeds, which the operation allows only when the
 *    config lives outside the root.
 */
export async function test_transformttsc_keeps_generated_tsconfig_outside_the_project_root(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [
          {
            transform: "./plugin.cjs",
            name: "fixture",
            operation: "assert-temp-tsconfig-outside-project",
          },
        ],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
