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
 *
 * @evidence contracts/testing.md#behavioral-verification Real Rollup bundle generates ESM chunks carrying PLUGIN before bundle close.
 * @evidence contracts/testing.md#independent-expectations Fixture uppercase output is fixed independently of Rollup chunk collection.
 * @evidence contracts/testing.md#distinguishing-cases Positive native transform through real Rollup; dependency and source-map paths have separate cases.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_rollup_adapter_runs_the_configured_ttsc_source_transform is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual Rollup plugin pipeline joins built adapter to native transformation.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Bundles close in finally; mutable sources and retained caches belong to this fixture. Tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: real Rollup bundle generates ESM chunks carrying PLUGIN before bundle close. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_rollup_adapter_runs_the_configured_ttsc_source_transform(
  preparedRoot?: string,
  observeClosed?: () => void,
): Promise<void> {
  const unpluginRollup =
    await TestUnpluginRuntime.loadUnpluginAdapter("rollup");
  const root = preparedRoot ?? TestUnpluginProject.createProject();
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
    observeClosed?.();
  }
}
