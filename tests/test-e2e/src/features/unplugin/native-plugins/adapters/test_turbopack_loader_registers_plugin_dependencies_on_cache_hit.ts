import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { emitDependenciesPlugins } from "../../../../internal/unplugin/internal/adapter-turbopack/emitDependenciesPlugins";
import { projectRecordOf } from "../../../../internal/unplugin/internal/adapter-turbopack/projectRecordOf";
import { runTurbopackLoaderWithContext } from "../../../../internal/unplugin/internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies a cache-served transform still registers the project's record.
 *
 * The loader shares one transform cache across requests for the worker's
 * lifetime, but Turbopack rebuilds its `fileDependencies` set per loader
 * invocation. A cache hit that skipped re-registration would drop invalidation
 * for every later request.
 *
 * 1. Configure a plugin that reports `src/types.d.ts`.
 * 2. Run the loader twice on the entry module, a fresh compile and a cache hit.
 * 3. Assert both runs register the record, and nothing else.
 *
 * @evidence contracts/testing.md#behavioral-verification First and second loader calls both produce PLUGIN and exactly the project-record dependency.
 * @evidence contracts/testing.md#independent-expectations Host dependency sets are per invocation; fixed record path is computed from fixture identity, not transformed output.
 * @evidence contracts/testing.md#distinguishing-cases Initial delivery versus repeated delivery with identical reported dependency.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_turbopack_loader_registers_plugin_dependencies_on_cache_hit is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Built loader/native generation joins captured addDependency callback; actual host cache behavior is outside scope.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. Normal end hooks close modeled owners where invoked; failure/cancellation cleanup lacks a finally guarantee here. Runner exit bounds remaining sessions and tracked roots.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: first and second loader calls both produce PLUGIN and exactly the project-record dependency. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_turbopack_loader_registers_plugin_dependencies_on_cache_hit(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = {
    plugins: emitDependenciesPlugins(["src/types.d.ts"]),
  };
  const expected = [projectRecordOf(root)];

  const first = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options,
  });
  TestUnpluginProject.assertTransformedToPlugin(first.content);
  assert.deepEqual(first.dependencies, expected);

  const second = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options,
  });
  TestUnpluginProject.assertTransformedToPlugin(second.content);
  assert.deepEqual(second.dependencies, expected);
}
