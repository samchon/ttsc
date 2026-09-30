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
 * @evidence contracts/testing.md#behavioral-verification Actual authored notifyWatchInputs derives and delivers this file's list through selectWatchInputs; exact dependency, graph, universal host and missing nearer-config paths distinguish incorrect narrowing or lost registration.
 * @evidence contracts/testing.md#independent-expectations Literal graph edges and reported dependencies specify the protocol input, while the independently enumerated expected list follows completeness and volatility rules; no production selector computes the oracle.
 * @evidence contracts/testing.md#distinguishing-cases A reported dependency outside the graph must remain while unread transitive and ambient graph inputs drop; empty dependencies and contradictory volatility have separate named units.
 * @evidence contracts/testing.md#execution-ownership This named source unit supplies a handwritten consumer envelope to the actual notification owner with real cheap filesystem inputs. Native successful envelope assembly remains in test_transformttsc_composes_a_mixed_completeness_envelope_per_file, and actual volatile producer output and delivery remain in test_transformttsc_volatile_file_bypasses_the_transform_cache; this unit makes no native-producer claim.
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
