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
 * Verifies a file the envelope declares complete is invalidated only by the
 * plugin's own reported inputs plus the universal config chain: the graph's
 * reachability closure from that file and its global-scope files both drop,
 * while a declared input the graph never named still registers.
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
