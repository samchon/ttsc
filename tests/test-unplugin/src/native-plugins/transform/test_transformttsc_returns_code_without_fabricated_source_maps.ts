import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies the transform result carries no `map` property.
 *
 * A map the adapter cannot actually compute would override the bundler's own
 * source-map pipeline with a fabricated one. Until real maps exist, returning
 * code alone lets the bundler keep its own.
 *
 * 1. Create a project with no configured plugins.
 * 2. Transform with the fixture plugin inline.
 * 3. Assert the result has no `map` property.
 */
export async function test_transformttsc_returns_code_without_fabricated_source_maps(): Promise<void> {
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
  assert.equal("map" in result, false);
}
