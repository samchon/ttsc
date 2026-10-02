import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { emitDependenciesPlugins } from "../../../../internal/unplugin/internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../../../internal/unplugin/internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies a loader context without `addDependency` still transforms without
 * throwing.
 *
 * A minimal stub or a Turbopack build predating the method has no
 * `addDependency`. The dependency channel is a best-effort enhancement, not a
 * requirement of the loader contract, so its absence must not fail the
 * transform.
 *
 * 1. Configure a plugin that reports a dependency.
 * 2. Run the loader through a context that omits `addDependency`.
 * 3. Assert the output is transformed and nothing was registered.
 *
 * @evidence contracts/testing.md#behavioral-verification Context omitting addDependency still returns PLUGIN and captures no dependencies.
 * @evidence contracts/testing.md#independent-expectations Optional host channel must not be a transform precondition; fixture rewrite fixes output.
 * @evidence contracts/testing.md#distinguishing-cases Reported dependency with absent host channel, paired with present-channel registration cases.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_transforms_without_an_add_dependency_context is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built loader handles a captured older/minimal context while native plugin reports dependencies.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: context omitting addDependency still returns PLUGIN and captures no dependencies. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_turbopack_loader_transforms_without_an_add_dependency_context(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: emitDependenciesPlugins(["src/types.d.ts"]),
    },
    omitAddDependency: true,
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, []);
}
