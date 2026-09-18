import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { fixtureHostInputs } from "../../internal/transform-graph/fixtureHostInputs";

/**
 * Verifies graph inputs and plugin-reported dependencies register as one
 * deduplicated union.
 *
 * The two channels overlap. An input reported through both must arrive once,
 * while each channel's exclusive entries must still register.
 *
 * 1. Transform with a plugin reporting two dependencies and a graph with two
 *    edges, one path shared.
 * 2. Record every registered watch file.
 * 3. Assert the union of both channels and the universal inputs, with the shared
 *    path once.
 */
export async function test_transformttsc_registers_graph_and_dependencies_as_a_union(): Promise<void> {
  const { resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = TestUnpluginProject.createProject({ plugins: [] });
  const watched: string[] = [];

  const result = await transformTtsc(
    TestUnpluginProject.mainFile(root),
    TestUnpluginProject.mainSource(root),
    resolveOptions({
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "dependencies",
          operation: "emit-dependencies",
          dependencies: ["src/shared.d.ts", "src/only-dependency.d.ts"],
        },
        {
          transform: "./plugin.cjs",
          name: "graph",
          operation: "emit-graph",
          edges: { "src/main.ts": ["src/shared.d.ts", "src/only-graph.d.ts"] },
        },
      ],
    }),
    undefined,
    undefined,
    { addWatchFile: (file: string) => watched.push(file) },
  );

  assert.ok(result);
  assert.deepEqual(
    [...watched].sort(),
    [
      path.join(root, "src", "shared.d.ts"),
      path.join(root, "src", "only-dependency.d.ts"),
      path.join(root, "src", "only-graph.d.ts"),
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
