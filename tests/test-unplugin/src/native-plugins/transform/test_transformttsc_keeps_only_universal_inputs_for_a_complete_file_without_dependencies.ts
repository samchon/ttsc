import { TestUnpluginProject } from "@ttsc/testing";
import assert from "node:assert/strict";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { declareComplete } from "../../internal/transform-complete/declareComplete";
import { fixtureHostInputs } from "../../internal/transform-complete/fixtureHostInputs";
import { watchInputs } from "../../internal/transform-complete/watchInputs";
import { emitGraphPlugins } from "../../internal/transform-graph/emitGraphPlugins";

/**
 * Verifies the empty-declaration boundary: a file declared complete with no
 * `dependencies` entry at all claims no input beyond itself, so only the
 * universal config chain registers.
 */
export async function test_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies(): Promise<void> {
  const root = TestUnpluginProject.createProject({ plugins: [] });

  const watched = await watchInputs(TestUnpluginProject.mainFile(root), [
    ...emitGraphPlugins(GRAPH),
    declareComplete(["src/main.ts"]),
  ]);

  assert.deepEqual(watched, fixtureHostInputs(root).sort());
}
