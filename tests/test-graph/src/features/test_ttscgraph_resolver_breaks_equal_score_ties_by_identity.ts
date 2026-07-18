import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver ranking: equal-score ties use stable graph identity.
 *
 * JavaScript's stable sort preserves input order when the comparator returns
 * zero, but graph input order is compiler visitation order. Equal relevance
 * therefore needs an explicit identity tie-break so two equivalent dumps
 * agree.
 *
 * 1. Build three equal-score candidates in two opposite visitation orders.
 * 2. Resolve the same ambiguous name from both memories.
 * 3. Assert both results use the same ascending id order.
 */
export const test_ttscgraph_resolver_breaks_equal_score_ties_by_identity =
  () => {
    const nodes: ResolverGraphNode[] = ["c", "a", "b"].map((letter) => ({
      id: `src/${letter}.ts#Tied:class`,
      kind: "class",
      name: "Tied",
      file: `src/${letter}.ts`,
      external: false,
    }));
    const expected = [
      "src/a.ts#Tied:class",
      "src/b.ts#Tied:class",
      "src/c.ts#Tied:class",
    ];

    const forward = resolveSyntheticGraph(nodes, "Tied", 3);
    const reverse = resolveSyntheticGraph([...nodes].reverse(), "Tied", 3);
    assert.deepStrictEqual(
      forward.candidates?.map((node) => node.id),
      expected,
    );
    assert.deepStrictEqual(
      reverse.candidates?.map((node) => node.id),
      expected,
    );
  };
