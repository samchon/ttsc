import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { fixtureHostInputs } from "../../internal/transform-graph/fixtureHostInputs";

/**
 * Verifies graph-derived inputs and plugin-reported dependencies register as a
 * deduplicated union: an input reported through both channels arrives once, and
 * each channel contributes its exclusive entries.
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
