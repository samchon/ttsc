import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies cache-hit sibling deliveries of one graph-bearing generation do not
 * re-probe the filesystem per module (samchon/ttsc#1007).
 *
 * Watch-input derivation must pay the graph's identity computations once per
 * generation; after that a delivery costs only its own memoized lookups. Before
 * the fix every delivery re-walked the whole edge set with filesystem work per
 * path, which scaled O(modules x edges) into the samchon/ttsc#970 stall. The
 * probe counter observes the shared path-identity resolver's physical-path
 * lookup on every host, so the bound holds identically across platforms.
 *
 * 1. Open a pass over a project whose graph fans out to 24 externals, counting
 *    `realpath` probes.
 * 2. Deliver every module and record its watch inputs.
 * 3. Assert the probes per cache-hit delivery stay within the fan-out bound.
 */
export async function test_transformttsc_bounds_watch_derivation_probes_per_module(): Promise<void> {
  const {
    beginTtscTransformBuild,
    createTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const graphFanout = 24;
  const project = createCacheProject({ fileCount: 6, graphFanout });
  const modules = projectModules(project.root);
  const probes = { calls: 0 };
  const cache = createTtscTransformCache({
    realpath: (location: string) => {
      probes.calls += 1;
      return fs.realpathSync.native(location);
    },
  });
  beginTtscTransformBuild(cache);
  const options = resolveOptions();

  // The first delivery compiles, so it needs the real platform for the
  // native spawn; the remaining deliveries are pure cache hits.
  const watched = new Map<string, string[]>();
  const deliver = (file: string) =>
    transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
      {
        addWatchFile: (input: string) => {
          const list = watched.get(file) ?? [];
          list.push(input);
          watched.set(file, list);
        },
      },
    );
  await deliver(modules[0]!);

  probes.calls = 0;
  for (const file of modules.slice(1)) {
    await deliver(file);
  }

  // Derivation parity: each module registers its own reach union, minus
  // itself, plus the universal config chain, the plugin's Go source
  // (samchon/ttsc#1487), and the nearer config its selection looked for
  // (samchon/ttsc#1543).
  const expected = (file: string) =>
    [
      ...modules.filter((other) => other !== file),
      ...Array.from({ length: graphFanout }, (_, index) =>
        path.join(project.root, "node_modules", `dep${index}`, "index.d.ts"),
      ),
      path.join(project.root, "package.json"),
      path.join(project.root, "plugin.cjs"),
      path.join(path.dirname(file), "tsconfig.json"),
      path.join(project.root, "tsconfig.json"),
      TestUnpluginProject.pluginSource(project.root),
    ].sort();
  for (const file of modules) {
    assert.deepEqual([...(watched.get(file) ?? [])].sort(), expected(file));
  }

  const perDelivery = probes.calls / (modules.length - 1);
  assert.ok(
    perDelivery <= 24,
    `watch derivation re-probed the filesystem ${perDelivery.toFixed(1)} times per delivery (bound: 24)`,
  );
}
