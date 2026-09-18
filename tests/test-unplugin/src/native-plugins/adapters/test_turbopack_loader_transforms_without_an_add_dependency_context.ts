import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";

/**
 * Verifies a loader context that does not expose `addDependency` (a minimal
 * stub or a Turbopack build predating the method) still transforms without
 * throwing. The dependency channel is a best-effort enhancement, not a hard
 * requirement of the loader contract.
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
