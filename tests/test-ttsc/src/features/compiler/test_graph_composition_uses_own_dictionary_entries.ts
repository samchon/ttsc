import assert from "node:assert/strict";

import { mergeCheckGraphs } from "../../../../../packages/ttsc/src/compiler/internal/build/appendBuildOutput";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";

/**
 * Verifies phase composition treats graph maps as own-entry dictionaries.
 *
 * 1. Merge reserved and ordinary keys from either phase and both phases.
 * 2. Preserve empty lists and deduplicate actual overlapping lists.
 * 3. Contrast inherited observations with owned agreeing and conflicting ones.
 * 4. Require ordinary public objects with literal reserved failure keys.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the maintained graph combiner on authored dictionaries; list unions cannot crash on inherited Object members and inherited observations cannot invent conflicts or replace owned witnesses.
 * @evidence contracts/testing.md#independent-expectations Literal arrays and own-property semantics define the union and conflict verdict; ordinary Object.prototype is the established public result shape.
 * @evidence contracts/testing.md#distinguishing-cases Both list maps cover left-only, right-only, empty and overlapping entries for __proto__, constructor, toString and an ordinary key. Observation cases distinguish inherited-only, genuinely owned agreement and conflict, with sticky failure after a later agreeing phase.
 * @evidence contracts/testing.md#execution-ownership A discoverable portable unit uses in-memory records and call-local prototypes; it starts no compiler or host and changes no global prototype.
 */
export function test_graph_composition_uses_own_dictionary_entries(): void {
  type Graph = NonNullable<TtscBuildResult["graph"]>;
  const graph = (extra: Partial<Graph> = {}): Graph => ({
    edges: {},
    globals: [],
    configs: [],
    ...extra,
  });
  for (const key of ["__proto__", "constructor", "toString", "source.ts"]) {
    for (const field of ["edges", "candidates"] as const) {
      for (const values of [[], ["dep.ts"]]) {
        const owned = graph({ [field]: Object.fromEntries([[key, values]]) });
        for (const pair of [
          [owned, graph()],
          [graph(), owned],
        ]) {
          const merged = mergeCheckGraphs(pair[0], pair[1])!;
          assert.ok(Object.hasOwn(merged[field]!, key));
          assert.deepEqual(merged[field]![key], values);
        }
      }
      assert.deepEqual(
        mergeCheckGraphs(
          graph({ [field]: Object.fromEntries([[key, ["a", "b"]]]) }),
          graph({ [field]: Object.fromEntries([[key, ["b", "c"]]]) }),
        )![field]![key],
        ["a", "b", "c"],
      );
    }
    const observation = (fileExists: boolean) =>
      Object.fromEntries([[key, { fileExists }]]);
    const owned = graph({ inputObservations: observation(true) });
    const inherited = graph({
      inputObservations: Object.create(observation(false)),
    });
    for (const pair of [
      [owned, inherited],
      [inherited, owned],
    ]) {
      const merged = mergeCheckGraphs(pair[0], pair[1])!;
      assert.deepEqual(merged.inputObservations, observation(true));
      assert.deepEqual(merged.inputProofFailures, {});
    }
    const conflicted = mergeCheckGraphs(
      owned,
      graph({ inputObservations: observation(false) }),
    )!;
    const failures = conflicted.inputProofFailures!;
    assert.equal(Object.getPrototypeOf(failures), Object.prototype);
    assert.ok(Object.hasOwn(failures, key));
    assert.equal(failures[key], "conflicting-check-generations");
    assert.deepEqual(
      mergeCheckGraphs(conflicted, owned)!.inputProofFailures,
      failures,
    );
    assert.deepEqual(mergeCheckGraphs(owned, owned)!.inputProofFailures, {});
  }
}
