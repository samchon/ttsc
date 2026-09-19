import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitDependenciesPlugins } from "../../internal/adapter-turbopack/emitDependenciesPlugins";
import { runTurbopackLoaderWithContext } from "../../internal/adapter-turbopack/runTurbopackLoaderWithContext";
import { universalHostInputs } from "../../internal/adapter-turbopack/universalHostInputs";

/**
 * Verifies the loader hands Turbopack no dependency outside Turbopack's root,
 * and marks the module whose input it left out (samchon/ttsc#1422).
 *
 * Turbopack fails a whole module whose dependency climbs above its project
 * filesystem root. A plugin-reported dependency beside the project, a
 * `typeRoots` entry, or an `extends` from a parent directory answered the page
 * with an error.
 *
 * 1. Configure a plugin reporting one dependency inside the project and one beside
 *    it, and a rule whose Turbopack root is the project.
 * 2. Run the loader on the entry module.
 * 3. Assert the output is transformed, the dependencies are the inside one and the
 *    universal host inputs, and the per-process marker is registered.
 */
export async function test_turbopack_loader_keeps_dependencies_inside_its_root(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const outside = path.join(
    path.dirname(root),
    `${path.basename(root)}-sibling`,
    "types.d.ts",
  );
  const { content, dependencies } = await runTurbopackLoaderWithContext({
    resourcePath: TestUnpluginProject.mainFile(root),
    source: TestUnpluginProject.mainSource(root),
    options: {
      plugins: emitDependenciesPlugins(["src/types.d.ts", outside]),
      turbopackRoots: [root],
    },
  });
  TestUnpluginProject.assertTransformedToPlugin(content);
  const markers = dependencies.filter(
    (file) => path.basename(file) === "untracked-inputs",
  );
  assert.deepEqual(
    dependencies.filter((file) => !markers.includes(file)),
    [path.join(root, "src", "types.d.ts"), ...universalHostInputs(root)],
    "no dependency outside Turbopack's root reaches Turbopack",
  );
  assert.equal(markers.length, 1, "the module depends on the process marker");
  assert.equal(
    path.basename(path.dirname(path.dirname(markers[0]!))),
    "ttsc",
    "the marker lives in a project's own tool cache",
  );
}
