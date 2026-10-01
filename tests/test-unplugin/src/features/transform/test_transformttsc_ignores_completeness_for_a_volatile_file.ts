import assert from "node:assert/strict";
import path from "node:path";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { createWatchInputUnitFixture } from "../../internal/transform-complete/createWatchInputUnitFixture";

/**
 * Verifies a file declared both complete and volatile keeps the baseline union
 * of watch inputs.
 *
 * The two declarations contradict: an exact file-input set against an input no
 * file can represent. The conservative one has to win, since narrowing to the
 * declared set would drop inputs the volatile output might still depend on.
 *
 * 1. Supply a literal envelope with a reported dependency, a graph, a completeness declaration,
 *    and a volatility declaration for `src/main.ts`.
 * 2. Collect its watch inputs.
 * 3. Assert they are the full union of the reported dependency, the graph reach,
 *    and the universal inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual authored notifyWatchInputs derives and delivers this file's list through selectWatchInputs; exact dependency, graph, universal host and missing nearer-config paths distinguish incorrect narrowing or lost registration.
 * @evidence contracts/testing.md#independent-expectations Literal graph edges and reported dependencies specify the protocol input, while the independently enumerated expected list follows completeness and volatility rules; no production selector computes the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Contradictory complete and volatile declarations must retain transitive graph reach and ambient files as well as the reported dependency; complete-only and empty-complete cases have separate named units.
 * @evidence contracts/testing.md#execution-ownership This named source unit supplies a handwritten consumer envelope to the actual notification owner with real cheap filesystem inputs. Native successful envelope assembly remains in test_transformttsc_composes_a_mixed_completeness_envelope_per_file, and actual volatile producer output and delivery remain in test_transformttsc_volatile_file_bypasses_the_transform_cache; this unit makes no native-producer claim.
 */
export function test_transformttsc_ignores_completeness_for_a_volatile_file(): void {
  const fixture = createWatchInputUnitFixture();
  const watched = fixture.collect({
    type: "success",
    typescript: { "src/main.ts": "export const value = 1;" },
    graph: GRAPH,
    dependenciesComplete: ["src/main.ts"],
    dependencies: { "src/main.ts": ["src/consulted.d.ts"] },
    volatile: ["src/main.ts"],
    hostInputs: ["package.json", "plugin.cjs", "tsconfig.json"],
    pluginSources: { [path.join(fixture.root, "plugin-source")]: "unit-input-state" },
  });

  assert.deepEqual(
    watched,
    [
      path.join(fixture.root, "src/consulted.d.ts"),
      path.join(fixture.root, "src/unread.d.ts"),
      path.join(fixture.root, "src/deep.d.ts"),
      path.join(fixture.root, "src/ambient.d.ts"),
      ...fixture.universal,
    ].sort(),
  );
}
