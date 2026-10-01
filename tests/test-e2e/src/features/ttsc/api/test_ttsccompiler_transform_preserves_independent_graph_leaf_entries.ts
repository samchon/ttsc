import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  TtscCompiler,
  assert,
  createProject,
  tsgo,
} from "../../../internal/ttsc/internal/compiler";

/**
 * Verifies TtscCompiler.transform preserves empty graph entries for independent
 * root files.
 *
 * TypeScript-Go publishes a leaf as `edges[file] = []` so the source remains in
 * the graph's node universe and its compiler-time proof can be validated.
 * Dropping that key at the JavaScript boundary makes an import-free root
 * invisible to persistent cache validation.
 *
 * 1. Create a project with two root files that do not reference each other.
 * 2. Transform it through the real TypeScript-Go compiler.
 * 3. Assert both sources retain exact empty adjacency entries.
 *
 * @evidence contracts/testing.md#behavioral-verification Transforms two import-free root sources and requires success plus exact empty edge arrays for main.ts and isolated.ts.
 * @evidence contracts/testing.md#independent-expectations The authored sources contain no imports, so each must remain a present graph node with empty adjacency rather than disappearing from the node universe.
 * @evidence contracts/testing.md#distinguishing-cases Two independent included roots distinguish an explicit empty leaf from an absent key; type-only nonempty edges are checked by transform_failure_carries_reference_graph.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers the feature export and runs real native graph production through transform.
 * @evidence contracts/e2e.md#necessary-boundary Only a real native envelope verifies leaf keys are emitted and preserved through API transport; decoder fixtures already containing those keys cannot establish producer behavior.
 * @evidence contracts/e2e.md#shared-execution One no-plugin transform checks both independent roots; the package build and native compiler resolution are shared and no contributor build occurs.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh registered source/config files establish root membership without earlier results or output state. The synchronous child completes before assertions and TestProject owns fixture cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Both original exact empty-adjacency checks and success remain. This case does not assert graph global/config records or complete source hashes.
 */
export const test_ttsccompiler_transform_preserves_independent_graph_leaf_entries =
  () => {
    const root = createProject({
      files: FixtureFiles.read("ttsc/ttsccompiler_transform_preserves_independent_graph_leaf_entries/inputs-1"),
      source: "export const main: number = 1;\n",
    });
    const compiler = new TtscCompiler({
      binary: tsgo,
      cwd: root,
      plugins: false,
    });

    const result = compiler.transform();

    assert.equal(result.type, "success");
    assert.deepEqual(result.graph?.edges["src/main.ts"], []);
    assert.deepEqual(result.graph?.edges["src/isolated.ts"], []);
  };
