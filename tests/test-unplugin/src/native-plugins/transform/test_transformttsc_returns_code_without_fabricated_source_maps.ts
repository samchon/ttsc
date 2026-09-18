import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies that the object returned by `transformTtsc` does not include a `map`
 * property, preventing the adapter from overriding the bundler's source-map
 * pipeline with a fabricated map.
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
