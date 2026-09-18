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
 * Verifies a file declared both complete and volatile keeps the baseline union
 * of watch inputs.
 *
 * The two declarations contradict: an exact file-input set against an input no
 * file can represent. The conservative one has to win, since narrowing to the
 * declared set would drop inputs the volatile output might still depend on.
 *
 * 1. Transform with a reported dependency, a graph, a completeness declaration,
 *    and a volatility declaration for `src/main.ts`.
 * 2. Collect its watch inputs.
 * 3. Assert they are the full union of the reported dependency, the graph reach,
 *    and the universal inputs.
 */
export async function test_transformttsc_ignores_completeness_for_a_volatile_file(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });

  const watched = await watchInputs(TestUnpluginProject.mainFile(root), [
    reportDependencies(["src/consulted.d.ts"]),
    ...emitGraphPlugins(GRAPH),
    declareComplete(["src/main.ts"]),
    {
      transform: "./plugin.cjs",
      name: "volatile",
      operation: "emit-volatile",
      volatile: ["src/main.ts"],
    },
  ]);

  assert.deepEqual(
    watched,
    [
      member(root, "src/consulted.d.ts"),
      member(root, "src/unread.d.ts"),
      member(root, "src/deep.d.ts"),
      member(root, "src/ambient.d.ts"),
      ...fixtureHostInputs(root),
    ].sort(),
  );
}
