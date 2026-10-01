import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import path from "node:path";

const viteBuild = TestUnpluginProject.REQUIRE_FROM_UNPLUGIN("vite").build;

/**
 * Verifies a real Vite build transforms through the adapter.
 *
 * This is the Vite adapter's end-to-end contract. The build runs with `write:
 * false` and a silent log level, so it touches nothing on disk and every chunk
 * can be inspected in memory.
 *
 * 1. Build the project's entry with the Vite adapter.
 * 2. Collect the code of every output chunk.
 * 3. Assert the chunks carry the transformed marker.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Vite build output chunks contain PLUGIN, detecting missing adapter transform in bundle assembly.
 * @evidence contracts/testing.md#independent-expectations Fixture goUpper rewrite fixes PLUGIN independently of bundler output collection.
 * @evidence contracts/testing.md#distinguishing-cases Single positive source-transform build; serve and wrapper cases own distinct paths.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_vite_adapter_runs_the_configured_ttsc_source_transform is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual Vite build loads built adapter and native compiler rather than driving hooks alone.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: real Vite build output chunks contain PLUGIN, detecting missing adapter transform in bundle assembly. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_vite_adapter_runs_the_configured_ttsc_source_transform(): Promise<void> {
  const unpluginVite = await TestUnpluginRuntime.loadUnpluginAdapter("vite");
  const root = TestUnpluginProject.createProject();
  const output = await viteBuild({
    root,
    build: {
      minify: false,
      rollupOptions: {
        input: path.join(root, "src", "main.ts"),
      },
      write: false,
    },
    logLevel: "silent",
    plugins: [unpluginVite()],
  });

  const chunks = Array.isArray(output)
    ? output.flatMap((entry) => entry.output)
    : output.output;
  TestUnpluginProject.assertTransformedToPlugin(
    TestUnpluginProject.collectRollupOutputCode(chunks),
  );
}
