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
 * 1. Supply a literal envelope with a reported dependency, a graph, a completeness
 *    declaration, and a volatility declaration for `src/main.ts`.
 * 2. Collect its watch inputs.
 * 3. Assert they are the full union of the reported dependency, the graph reach,
 *    and the universal inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   The real notifyWatchInputs (through the fixture's collect helper) is handed an envelope whose src/main.ts is both in dependenciesComplete and volatile and has a reported dependency; the registered inputs must still contain the reported src/consulted.d.ts, the graph reach (src/unread.d.ts, src/deep.d.ts), the global src/ambient.d.ts and the universal inputs, so narrowing by completeness would fail.
 * @evidence contracts/testing.md#independent-expectations
 *   The expected list is enumerated in the test from the literal GRAPH edges and the reported dependency, following the rule that volatility keeps the baseline union; it is not computed by selectWatchInputs. The universal tail comes from the fixture's own list of package.json, plugin.cjs, tsconfig.json, the nearer src/tsconfig.json and plugin-source.
 * @evidence contracts/testing.md#distinguishing-cases
 *   One contradictory case: complete plus volatile. Contrast with the complete-only cases is in the sibling tests test_transformttsc_narrows_watch_inputs_for_a_file_declared_complete and test_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies, where the transitive and ambient inputs are dropped.
 * @evidence contracts/testing.md#execution-ownership
 *   Unit test: a synchronous function passes a handwritten success envelope to the real notifyWatchInputs with an addWatchFile hook over a small real temporary project; no compiler, plugin binary or host runs. The complementary mixed-completeness case remains test_transformttsc_composes_a_mixed_completeness_envelope_per_file. Declared-volatile cache refusal and repeated receiver-preserving callback policy are owned by tests/test-unplugin/src/features/transform/test_cached_generation_action_keeps_or_replaces_the_actual_owner.ts#test_cached_generation_action_keeps_or_replaces_the_actual_owner; this entry owns the full watch union. Neither these source units nor ordinary shared producer/callback transport certify supported native volatile acquisition.
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
    pluginSources: {
      [path.join(fixture.root, "plugin-source")]: "unit-input-state",
    },
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
