import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies plugins passed through the `plugins` option apply in their declared
 * order.
 *
 * Plugin transforms compose, so order changes the output. Three chained fixture
 * plugins make any reordering visible in the result.
 *
 * 1. Create a project with no configured plugins.
 * 2. Transform with a prefix, an upper-case, and a suffix plugin, in that order.
 * 3. Assert the output reads `"A:PLUGIN:Z"`.
 */
export async function test_transformttsc_applies_top_level_plugin_overrides_in_order(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        { transform: "./plugin.cjs", name: "prefix", prefix: "A:" },
        { transform: "./plugin.cjs", name: "upper" },
        { transform: "./plugin.cjs", name: "suffix", suffix: ":Z" },
      ],
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"A:PLUGIN:Z"/);
}
