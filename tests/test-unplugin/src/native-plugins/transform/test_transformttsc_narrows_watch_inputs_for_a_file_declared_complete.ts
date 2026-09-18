import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { declareComplete } from "../../internal/transform-complete/declareComplete";
import { fixtureHostInputs } from "../../internal/transform-complete/fixtureHostInputs";
import { member } from "../../internal/transform-complete/member";
import { reportDependencies } from "../../internal/transform-complete/reportDependencies";
import { watchInputs } from "../../internal/transform-complete/watchInputs";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies a file declared complete is watched only through its reported inputs
 * and the universal config chain.
 *
 * A completeness declaration transfers ownership of the file's dependency set
 * to the plugin. The graph's reachability closure from that file and its
 * global-scope files both drop, while an input the plugin reported but the
 * graph never named still registers.
 *
 * 1. Transform with two reported dependencies, one absent from the graph, a graph,
 *    and a completeness declaration for `src/main.ts`.
 * 2. Collect its watch inputs.
 * 3. Assert they are exactly the two reported dependencies and the universal
 *    inputs.
 */
export async function test_transformttsc_narrows_watch_inputs_for_a_file_declared_complete(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });

  const watched = await watchInputs(TestUnpluginProject.mainFile(root), [
    reportDependencies(["src/consulted.d.ts", "src/only-declared.d.ts"]),
    ...emitGraphPlugins(GRAPH),
    declareComplete(["src/main.ts"]),
  ]);

  assert.deepEqual(
    watched,
    [
      member(root, "src/consulted.d.ts"),
      member(root, "src/only-declared.d.ts"),
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
