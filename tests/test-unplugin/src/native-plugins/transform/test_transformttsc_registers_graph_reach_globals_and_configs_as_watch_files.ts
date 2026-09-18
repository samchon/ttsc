import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";
import { fixtureHostInputs } from "../../internal/transform-graph/fixtureHostInputs";

/**
 * Verifies the transform registers the graph's reach from the module, plus
 * `globals` and `configs`.
 *
 * The reachability closure must be transitive, through chains the bundler
 * cannot see, and ignore edges the module cannot reach. Every path is
 * absolutized against the project root and deduplicated, and the module itself
 * is excluded even when a cycle or the globals list points back at it.
 *
 * 1. Transform with a graph holding a transitive chain, a cycle back to the
 *    module, an unreachable edge, globals, and configs.
 * 2. Record every registered watch file.
 * 3. Assert exactly the reachable closure, globals, configs, and universal inputs,
 *    without the module itself.
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
