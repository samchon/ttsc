import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";
import { universalHostInputs } from "../../internal/adapter-turbopack/universalHostInputs";

/**
 * Verifies a cache-served transform still registers the dependency list.
 *
 * The Turbopack loader shares one transform cache for the worker lifetime
 * across requests, but Turbopack rebuilds its `fileDependencies` set per loader
 * invocation. A cache hit that skipped re-registration would drop invalidation
 * for the second and later requests, so the loader must replay the dependencies
 * on every call, not only the fresh compile.
 */
export async function test_turbopack_loader_registers_plugin_dependencies_on_cache_hit(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const options = {
    plugins: emitDependenciesPlugins(["src/types.d.ts"]),
  };
  const expected = [
    path.join(root, "src", "types.d.ts"),
    ...universalHostInputs(root),
  ];

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
