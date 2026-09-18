import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { declareComplete } from "../../internal/transform-complete/declareComplete";
import { fixtureHostInputs } from "../../internal/transform-complete/fixtureHostInputs";
import { watchInputs } from "../../internal/transform-complete/watchInputs";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies a file declared complete with no `dependencies` entry registers only
 * the universal inputs.
 *
 * This is the empty-declaration boundary. A completeness declaration with
 * nothing reported claims no input beyond the file itself, so neither the graph
 * reach nor anything else may be registered, while the config chain stays
 * universal.
 *
 * 1. Transform with a graph and a completeness declaration for `src/main.ts`,
 *    reporting no dependencies.
 * 2. Collect its watch inputs.
 * 3. Assert they are exactly the universal host inputs.
 */
export async function test_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });

  const watched = await watchInputs(TestUnpluginProject.mainFile(root), [
    ...emitGraphPlugins(GRAPH),
    declareComplete(["src/main.ts"]),
  ]);

  assert.deepEqual(watched, fixtureHostInputs(root).sort());
}
