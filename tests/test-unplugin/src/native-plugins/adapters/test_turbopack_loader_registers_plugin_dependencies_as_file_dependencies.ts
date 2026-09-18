import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";
import { universalHostInputs } from "../../internal/adapter-turbopack/universalHostInputs";

/**
 * Verifies the loader registers plugin-reported dependencies through
 * `addDependency`, normalized exactly as the other adapters normalize their
 * watch files: project-relative entries absolutized against the project root,
 * absolute entries kept, duplicates collapsed, and the transformed module
 * itself excluded.
 *
 * The standalone Turbopack loader used to call the shared transform without a
 * hooks argument, so the reported dependency list was silently dropped and
 * type-only inputs never entered Turbopack's invalidation graph. The dependency
 * list mixes a relative entry, an absolute entry, a duplicate, and the module
 * itself to pin the normalization.
 */
export async function test_turbopack_loader_registers_plugin_dependencies_as_file_dependencies(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const absolute = path.join(root, "types", "model.d.ts");
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: emitDependenciesPlugins([
        "src/types.d.ts",
        absolute,
        "src/types.d.ts",
        "src/main.ts",
      ]),
    },
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  assert.deepEqual(dependencies, [
    path.join(root, "src", "types.d.ts"),
    absolute,
    ...universalHostInputs(root),
  ]);
}
