import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";

const rollup = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("rollup").rollup;

/**
 * Verifies that running a real rollup build with the unplugin rollup adapter
 * produces plugin-transformed output.
 *
 * Generates in-memory ESM output, collects all chunk code via the shared
 * helper, and checks for the expected plugin marker. Always closes the bundle
 * to release file watchers.
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
