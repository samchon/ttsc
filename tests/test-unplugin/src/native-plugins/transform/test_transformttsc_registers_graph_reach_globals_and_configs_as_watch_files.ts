import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";
import { fixtureHostInputs } from "../../internal/transform-graph/fixtureHostInputs";

/**
 * Verifies the transform registers the host-owned reference graph's
 * contribution for the transformed file: the reachability closure of `edges`
 * from the file (transitively, through a chain the bundler cannot see), plus
 * `globals` and `configs` — absolutized against the project root, deduplicated,
 * with the module itself excluded even when a cycle or the globals list points
 * back at it, and with unreachable edges ignored.
 */
export async function test_transformttsc_registers_graph_reach_globals_and_configs_as_watch_files(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: emitGraphPlugins({
        edges: {
          "src/main.ts": ["src/a.d.ts"],
          // a -> b proves transitive reach; a -> main proves the module
          // itself stays excluded even through a cycle.
          "src/a.d.ts": ["src/b.d.ts", "src/main.ts"],
          // Unreachable from main.ts; must not be registered.
          "src/other.ts": ["src/unrelated.d.ts"],
        },
        globals: ["src/ambient.d.ts", "src/main.ts"],
        configs: ["tsconfig.json"],
      }),
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.match(result.code, /"PLUGIN"/);
  assert.deepEqual(
    [...watched].sort(),
    [
      path.join(root, "src", "a.d.ts"),
      path.join(root, "src", "b.d.ts"),
      path.join(root, "src", "ambient.d.ts"),
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
