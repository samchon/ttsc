import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

const rollup = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup").rollup;

/**
 * Verifies a real Rollup build transforms through the adapter.
 *
 * This is the Rollup adapter's end-to-end contract: a bundle whose output lacks
 * the plugin's rewrite means the transform never reached the module. The bundle
 * is always closed so its watchers do not leak into later scenarios.
 *
 * 1. Bundle the project's entry with the Rollup adapter.
 * 2. Generate in-memory ESM output.
 * 3. Assert the chunks carry the transformed marker, then close the bundle.
 */
export async function test_rollup_adapter_runs_the_configured_ttsc_source_transform(): Promise<void> {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const root = TestUnpluginProject.createProject();
  const bundle = await rollup({
    input: TestUnpluginProject.mainFile(root),
    plugins: [unpluginRollup()],
  });
  try {
    const generated = await bundle.generate({ format: "esm" });
    TestUnpluginProject.assertTransformedToPlugin(
      TestUnpluginProject.collectRollupOutputCode(generated.output),
    );
  } finally {
    await bundle.close();
  }
}
