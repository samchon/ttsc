import assert from "node:assert/strict";
import path from "node:path";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { createWatchInputUnitFixture } from "../../internal/transform-complete/createWatchInputUnitFixture";

/**
 * Verifies a file declared complete with no `dependencies` entry registers only
 * the universal inputs.
 *
 * This is the empty-declaration boundary. A completeness declaration with
 * nothing reported claims no input beyond the file itself, so neither the graph
 * reach nor anything else may be registered, while the config chain stays
 * universal.
 *
 * 1. Supply a literal envelope with a graph and a completeness declaration for `src/main.ts`,
 *    reporting no dependencies.
 * 2. Collect its watch inputs.
 * 3. Assert they are exactly the universal host inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual authored notifyWatchInputs derives and delivers this file's list through selectWatchInputs; exact dependency, graph, universal host and missing nearer-config paths distinguish incorrect narrowing or lost registration.
 * @evidence contracts/testing.md#independent-expectations Literal graph edges and reported dependencies specify the protocol input, while the independently enumerated expected list follows completeness and volatility rules; no production selector computes the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Absent dependencies on a complete file retain the config, descriptor, plugin-source and nearer-selection inputs while dropping graph reach and globals; nonempty and volatile cases have separate named units.
 * @evidence contracts/testing.md#execution-ownership This named source unit supplies a handwritten consumer envelope to the actual notification owner with real cheap filesystem inputs. Native successful envelope assembly remains in test_transformttsc_composes_a_mixed_completeness_envelope_per_file, and actual volatile producer output and delivery remain in test_transformttsc_volatile_file_bypasses_the_transform_cache; this unit makes no native-producer claim.
 */
export function test_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies(): void {
  const fixture = createWatchInputUnitFixture();
  const watched = fixture.collect({
    type: "success",
    typescript: { "src/main.ts": "export const value = 1;" },
    graph: GRAPH,
    dependenciesComplete: ["src/main.ts"],
    hostInputs: ["package.json", "plugin.cjs", "tsconfig.json"],
    pluginSources: { [path.join(fixture.root, "plugin-source")]: "unit-input-state" },
  });

  assert.deepEqual(
    watched,
    [...fixture.universal].sort(),
  );
}
