import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";
import { universalHostInputs } from "../../internal/adapter-turbopack/universalHostInputs";

/**
 * Verifies the loader registers plugin-reported dependencies through
 * `addDependency`, normalized as every other adapter normalizes them.
 *
 * The standalone loader used to call the shared transform without a hooks
 * argument, so the reported list was dropped and type-only inputs never entered
 * Turbopack's invalidation graph. Relative entries must be absolutized against
 * the project root, absolute ones kept, duplicates collapsed, and the module
 * itself excluded.
 *
 * 1. Configure a plugin reporting a relative entry, an absolute entry, a
 *    duplicate, and the module itself.
 * 2. Run the loader on the entry module.
 * 3. Assert the registered dependencies are the two normalized entries followed by
 *    the universal host inputs.
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
