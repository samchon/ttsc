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
 * 3. Assert the output reads `"A:PLUGIN:z"`: the prefix was uppercased and the
 *    later suffix was not.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual native fixture chain applies lowercase prefix a:, uppercase and lowercase suffix :z and must return A:PLUGIN:z. Uppercase must see the prefix but not the suffix, so incorrect native operation order cannot pass by applying the same commuting uppercase constants.
 * @evidence contracts/testing.md#independent-expectations The literal source marker plugin, prefix a: and suffix :z specify A:PLUGIN:z independently of native transform implementation. The uppercased A and preserved lowercase z independently pin each operation's position around uppercase; no other permutation of these three operations produces this result.
 * @evidence contracts/testing.md#distinguishing-cases Three explicit operations compose in a consumer whose tsconfig plugin list is empty. Lowercase prefix before uppercase contrasts with lowercase suffix after it: omitted stages, unchanged marker, moving prefix after uppercase or moving suffix before uppercase each yield different literal output.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_applies_top_level_plugin_overrides_in_order in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built JS transform API loads the consumer plugin descriptor and forwards its entry through generated configuration into an actual native fixture producer. A unit option parser cannot show the native consumer receives that configuration and returns transformed output.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject.createProject reuses the suite materialized native fixture plugin and build cache while allocating this consumer separately. The built public transform API is loaded once; this scenario needs its own config/source inputs but no independent package installation. All three entries route through the shared native fixture artifact in one project capture rather than separately building one producer per operation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestUnpluginProject allocates a unique consumer root and TestProject owns its lifetime through runner cleanup. No shared producer source is mutated; per-call uncached transform state cannot carry another entry's generation. This entry relies on runner lifetime for temporary directories.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_applies_top_level_plugin_overrides_in_order; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
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
        { transform: "./plugin.cjs", name: "prefix", prefix: "a:" },
        { transform: "./plugin.cjs", name: "upper" },
        { transform: "./plugin.cjs", name: "suffix", suffix: ":z" },
      ],
    }),
  );

  assert.ok(result);
  assert.match(result.code, /"A:PLUGIN:z"/);
}
