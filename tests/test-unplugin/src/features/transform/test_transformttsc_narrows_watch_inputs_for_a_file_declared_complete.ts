import assert from "node:assert/strict";
import path from "node:path";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { createWatchInputUnitFixture } from "../../internal/transform-complete/createWatchInputUnitFixture";

/**
 * Verifies a file declared complete is watched only through its reported inputs
 * and the universal config chain.
 *
 * A completeness declaration transfers ownership of the file's dependency set
 * to the plugin. The graph's reachability closure from that file and its
 * global-scope files both drop, while an input the plugin reported but the
 * graph never named still registers.
 *
 * 1. Supply a literal envelope with two reported dependencies, one absent from the graph, a graph,
 *    and a completeness declaration for `src/main.ts`.
 * 2. Collect its watch inputs.
 * 3. Assert they are exactly the two reported dependencies and the universal
 *    inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   The real notifyWatchInputs is handed an envelope declaring src/main.ts complete with two reported dependencies, one (src/only-declared.d.ts) absent from the graph; the registered inputs must be exactly those two plus the universal inputs, so keeping unread graph reach or globals, or dropping the unlisted dependency, fails.
 * @evidence contracts/testing.md#independent-expectations
 *   The expected list is enumerated in the test from the two reported dependencies and the fixture's universal inputs; the unread transitive (src/unread.d.ts, src/deep.d.ts) and ambient (src/ambient.d.ts) inputs named in the literal GRAPH are expected absent. selectWatchInputs does not compute the oracle.
 * @evidence contracts/testing.md#distinguishing-cases
 *   A reported dependency outside the graph must register while unread transitive and ambient graph inputs drop. The empty-dependencies and volatile variants are the sibling tests test_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies and test_transformttsc_ignores_completeness_for_a_volatile_file.
 * @evidence contracts/testing.md#execution-ownership
 *   Unit test: a synchronous function passes a handwritten success envelope to the real notifyWatchInputs with an addWatchFile hook over a small real temporary project; no compiler, plugin binary or host runs. Native envelope assembly is covered by the E2E test_transformttsc_composes_a_mixed_completeness_envelope_per_file.
 */
export function test_transformttsc_narrows_watch_inputs_for_a_file_declared_complete(): void {
  const fixture = createWatchInputUnitFixture();
  const watched = fixture.collect({
    type: "success",
    typescript: { "src/main.ts": "export const value = 1;" },
    graph: GRAPH,
    dependenciesComplete: ["src/main.ts"],
    dependencies: { "src/main.ts": ["src/consulted.d.ts", "src/only-declared.d.ts"] },
    hostInputs: ["package.json", "plugin.cjs", "tsconfig.json"],
    pluginSources: { [path.join(fixture.root, "plugin-source")]: "unit-input-state" },
  });

  assert.deepEqual(
    watched,
    [
      path.join(fixture.root, "src/consulted.d.ts"),
      path.join(fixture.root, "src/only-declared.d.ts"),
      ...fixture.universal,
    ].sort(),
  );
}
