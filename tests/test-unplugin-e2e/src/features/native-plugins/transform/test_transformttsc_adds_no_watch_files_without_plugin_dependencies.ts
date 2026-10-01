import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { fixtureHostInputs } from "../../../internal/transform-dependencies/fixtureHostInputs";

/**
 * Verifies a plugin that reports no `dependencies` makes the transform register
 * only the universal host inputs.
 *
 * Every registered path becomes something the bundler watches and invalidates
 * on. A transform that invented dependencies would rebuild modules on unrelated
 * edits, while the universal inputs (the plugin descriptor and the config
 * chain) must always be registered.
 *
 * 1. Transform with a plugin that reports no dependencies, recording every
 *    `addWatchFile` call.
 * 2. Assert the output is transformed.
 * 3. Assert the recorded paths are exactly the fixture's universal host inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual go-uppercase fixture transform returns output and addWatchFile must record exactly the consumer package.json, descriptor, tsconfig, absent nearer src/tsconfig.json and shared Go source location, with no invented plugin dependencies.
 * @evidence contracts/testing.md#independent-expectations fixtureHostInputs enumerates deliberate descriptor/config discovery inputs and producer identity without calling the watch derivation implementation. Sorted equality permits registration order variation while refusing extra or missing paths. The source marker is not separately inspected here.
 * @evidence contracts/testing.md#distinguishing-cases A producer reporting no dependencies still retains universal host/config inputs, including the absent nearer config candidate. Positive plugin dependencies and graph union are owned by separate entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_adds_no_watch_files_without_plugin_dependencies in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The built JS transform API loads the consumer plugin descriptor and forwards its entry through generated configuration into an actual native fixture producer. A unit option parser cannot show the native consumer receives that configuration and returns transformed output.
 * @evidence contracts/e2e.md#shared-execution TestUnpluginProject.createProject reuses the suite materialized native fixture plugin and build cache while allocating this consumer separately. The built public transform API is loaded once; this scenario needs its own config/source inputs but no independent package installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestUnpluginProject allocates a unique consumer root and TestProject owns its lifetime through runner cleanup. No shared producer source is mutated; per-call uncached transform state cannot carry another entry's generation. This entry relies on runner lifetime for temporary directories. The watched array is new for this one delivery and no supplied transform cache can replay an earlier registration.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_adds_no_watch_files_without_plugin_dependencies; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_adds_no_watch_files_without_plugin_dependencies(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "go-uppercase",
        },
      ],
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.deepEqual([...watched].sort(), fixtureHostInputs(root).sort());
}
