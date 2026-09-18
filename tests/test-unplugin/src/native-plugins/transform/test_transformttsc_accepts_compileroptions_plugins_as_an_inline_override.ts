import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that `compilerOptions.plugins` supplied via `resolveOptions` is
 * applied even when the project's tsconfig carries no plugins.
 */
export async function test_transformttsc_accepts_compileroptions_plugins_as_an_inline_override(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      compilerOptions: {
        plugins: [{ transform: "./plugin.cjs", name: "fixture" }],
      },
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
