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
 * @evidence contracts/testing.md#behavioral-verification
 *   The real notifyWatchInputs is handed an envelope with a graph and src/main.ts in dependenciesComplete but no dependencies entry; the registered inputs must equal exactly the universal inputs, so any graph reach (src/unread.d.ts, src/deep.d.ts) or global (src/ambient.d.ts) leaking in fails.
 * @evidence contracts/testing.md#independent-expectations
 *   The expected list is the fixture's own enumeration of universal inputs (package.json, plugin.cjs, tsconfig.json, the nearer src/tsconfig.json, plugin-source), sorted; the dropped graph inputs are named in the shared literal GRAPH. selectWatchInputs does not compute the oracle.
 * @evidence contracts/testing.md#distinguishing-cases
 *   One boundary case: complete with nothing reported. The config, descriptor, plugin-source and nearer-selection inputs stay while graph reach and globals drop; the nonempty-dependencies and volatile variants are the sibling tests test_transformttsc_narrows_watch_inputs_for_a_file_declared_complete and test_transformttsc_ignores_completeness_for_a_volatile_file.
 * @evidence contracts/testing.md#execution-ownership
 *   Unit test: a synchronous function passes a handwritten success envelope to the real notifyWatchInputs with an addWatchFile hook over a small real temporary project; no compiler, plugin binary or host runs. Native envelope assembly is covered by the E2E test_transformttsc_composes_a_mixed_completeness_envelope_per_file.
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
