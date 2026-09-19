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
 *    universal host inputs, the per-process marker is registered, and no
 *    warning is printed, since the configuration names the root.
 * 4. Run it on a project whose configuration names no root, twice, and assert one
 *    warning names that project and the setting that removes the cost.
 */
export async function test_turbopack_loader_keeps_dependencies_inside_its_root(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const outside = path.join(
    path.dirname(root),
    `${path.basename(root)}-sibling`,
    "types.d.ts",
  );
  const warnings: string[] = [];
  const listen = (warning: Error & { code?: string }): void => {
    if (warning.code === "TTSC_TURBOPACK_UNTRACKED_INPUTS") {
      warnings.push(warning.message);
    }
  };
  // Node dispatches a process warning on a later tick.
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  process.on("warning", listen);
  const run = (project: string, turbopackRoots?: string[]) =>
    runTurbopackLoaderWithContext({
      resourcePath: TestUnpluginProject.mainFile(project),
      source: TestUnpluginProject.mainSource(project),
      options: {
        plugins: emitDependenciesPlugins(["src/types.d.ts", outside]),
        ...(turbopackRoots === undefined ? {} : { turbopackRoots }),
      },
    });
  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run(root, [root]);
    await settle();
    assert.equal(warnings.length, 0, "a named root leaves nothing to warn of");
    const unnamed = TestUnpluginProject.createProject({ plugins: [] });
    await run(unnamed);
    await run(unnamed);
    await settle();
    assert.equal(warnings.length, 1, "one warning per project");
    assert.ok(warnings[0]!.includes(unnamed));
    assert.ok(warnings[0]!.includes("`turbopack.root`"));
  } finally {
    process.off("warning", listen);
  }
  const { content, dependencies } = result;
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
