import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies `compilerOptions.plugins` passed through `resolveOptions` applies
 * when the tsconfig declares no plugins.
 *
 * A host can configure plugins inline instead of in the tsconfig. The overlay
 * must reach the compile, or those plugins would silently never run.
 *
 * 1. Create a project whose tsconfig declares no plugins.
 * 2. Transform with the fixture plugin in `compilerOptions.plugins`.
 * 3. Assert the output is transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification transformTtsc receives a fixture plugin through resolveOptions.compilerOptions.plugins while the consumer tsconfig has none; returned output must contain PLUGIN, detecting a wrapper that drops the inline compiler overlay.
 * @evidence contracts/testing.md#independent-expectations The fixture uppercases its deliberate plugin marker; literal PLUGIN follows that operation independently of option-merging implementation. This case asserts changed output presence but does not independently assert the adjacent source text remains intact.
 * @evidence contracts/testing.md#distinguishing-cases An empty tsconfig plugin list with one inline fixture entry is the owned override path. Top-level plugin order and discovered tsconfig plugin configuration are complementary entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_accepts_compileroptions_plugins_as_an_inline_override in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built JS transform API loads the consumer plugin descriptor and forwards its entry through generated configuration into an actual native fixture producer. A unit option parser cannot show the native consumer receives that configuration and returns transformed output.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject.createProject reuses the suite materialized native fixture plugin and build cache while allocating this consumer separately. The built public transform API is loaded once; this scenario needs its own config/source inputs but no independent package installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestUnpluginProject allocates a unique consumer root and TestProject owns its lifetime through runner cleanup. No shared producer source is mutated; per-call uncached transform state cannot carry another entry's generation. This entry relies on runner lifetime for temporary directories.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_accepts_compileroptions_plugins_as_an_inline_override; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
