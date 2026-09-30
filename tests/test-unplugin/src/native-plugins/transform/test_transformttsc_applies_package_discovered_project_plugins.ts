import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/**
 * Verifies a plugin installed as a package under `node_modules` is discovered
 * and applied without an explicit plugin list.
 *
 * Ttsc discovers plugins that packages declare, the same way the command-line
 * compiler does. An adapter that honored only explicit lists would compile such
 * a project untransformed.
 *
 * 1. Create a project with no configured plugins.
 * 2. Install the fixture plugin as a package.
 * 3. Transform the entry and assert the output is transformed.
 *
 * @evidence contracts/testing.md#behavioral-verification A consumer with no configured plugin list receives the fixture-auto package declaration; transformTtsc must return output containing PLUGIN, exposing discovery limited to explicit configuration.
 * @evidence contracts/testing.md#independent-expectations The package fixture advertises the native transformation and the source fixture starts with its lowercase marker. Literal PLUGIN requires that advertised transform to run without asking the discovery implementation for an expected result; unchanged adjacent text is not independently asserted.
 * @evidence contracts/testing.md#distinguishing-cases No explicit tsconfig or inline plugins plus one installed auto-discovered package is this contribution. Configured discovery and explicit inline override are separate entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_applies_package_discovered_project_plugins in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built JS transform API loads the consumer plugin descriptor and forwards its entry through generated configuration into an actual native fixture producer. A unit option parser cannot show the native consumer receives that configuration and returns transformed output.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject.createProject reuses the suite materialized native fixture plugin and build cache while allocating this consumer separately. The built public transform API is loaded once; this scenario needs its own config/source inputs but no independent package installation. writePackagePlugin adds the package descriptor layout only; it routes to the already materialized fixture producer.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestUnpluginProject allocates a unique consumer root and TestProject owns its lifetime through runner cleanup. No shared producer source is mutated; per-call uncached transform state cannot carry another entry's generation. This entry relies on runner lifetime for temporary directories.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_applies_package_discovered_project_plugins; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_applies_package_discovered_project_plugins(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  TestUnpluginProject.writePackagePlugin(root, "fixture-auto");

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions(),
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
}
