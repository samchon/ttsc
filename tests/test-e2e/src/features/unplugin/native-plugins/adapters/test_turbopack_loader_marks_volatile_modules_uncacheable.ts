import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { runTurbopackLoaderWithContext } from "../../../../internal/unplugin/internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies the loader marks a plugin-declared volatile module uncacheable, and
 * never toggles cacheability otherwise.
 *
 * A volatile module's output depends on non-file inputs, which no
 * `fileDependencies` snapshot can represent. `cacheable(false)` is the only
 * loader-level channel that excludes it from caching, and calling it for an
 * ordinary module would disable caching for no reason.
 *
 * 1. Run the loader with a plugin that declares the module volatile.
 * 2. Assert the output is transformed and `cacheable(false)` was called once.
 * 3. Run it with an ordinary transform and assert `cacheable` was never called.
 *
 * @evidence contracts/testing.md#behavioral-verification Volatile output carries PLUGIN with numeric suffix and exactly cacheable(false); ordinary PLUGIN invokes no cacheability toggle.
 * @evidence contracts/testing.md#independent-expectations Volatility contract requires disabling host cache; helper independently verifies cacheable receiver binding.
 * @evidence contracts/testing.md#distinguishing-cases Volatile versus hermetic options on the same source.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_marks_volatile_modules_uncacheable is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built loader propagates native volatility to captured host channel; actual host cache reuse is not run.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: volatile output carries PLUGIN with numeric suffix and exactly cacheable(false); ordinary PLUGIN invokes no cacheability toggle. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_turbopack_loader_marks_volatile_modules_uncacheable(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const volatileRun = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "emit-volatile",
          volatile: ["src/main.ts"],
        },
      ],
    },
  });
  assert.match(volatileRun.content, /"PLUGIN:\d+"/);
  assert.deepEqual(volatileRun.cacheableCalls, [false]);

  const hermeticRun = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "fixture",
          operation: "go-uppercase",
        },
      ],
    },
  });
  TestUnpluginProject.assertTransformedToPlugin(hermeticRun.content);
  assert.deepEqual(hermeticRun.cacheableCalls, []);
}
