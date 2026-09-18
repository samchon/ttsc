import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that the synthetic tsconfig written by `transformTtsc` is placed
 * outside the project root, verified by the fixture plugin's
 * `assert-temp-tsconfig-outside-project` operation.
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
