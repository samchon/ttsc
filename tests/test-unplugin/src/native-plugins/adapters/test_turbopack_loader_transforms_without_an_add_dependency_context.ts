import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";

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
