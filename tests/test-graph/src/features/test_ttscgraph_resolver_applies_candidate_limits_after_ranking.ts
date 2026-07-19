import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver ranking: candidate limits cap only the ranked response.
 *
 * The limit is a payload boundary, not a search boundary. Small and oversized
 * limits must both preserve the same best candidate while returning no more
 * than the caller requested.
 *
 * 1. Build five exact-name candidates with the exported winner last.
 * 2. Resolve them with zero, small, exact, and oversized limits.
 * 3. Assert each length is bounded and every non-empty result starts with the
 *    winner.
 */
export const test_ttscgraph_resolver_applies_candidate_limits_after_ranking =
  () => {
    const nodes: ResolverGraphNode[] = Array.from(
      { length: 5 },
      (_, index) => ({
        id: `src/limit-${String(index)}.ts#Bounded:class`,
        kind: "class",
        name: "Bounded",
        file: `src/limit-${String(index)}.ts`,
        external: false,
        ...(index === 4 ? { exported: true } : {}),
      }),
    );

    for (const [limit, expectedLength] of [
      [0, 0],
      [1, 1],
      [3, 3],
      [5, 5],
      [8, 5],
    ] as const) {
      const resolved = resolveSyntheticGraph(nodes, "Bounded", limit);
      assert.strictEqual(resolved.candidates?.length, expectedLength);
      if (expectedLength > 0)
        assert.strictEqual(resolved.candidates?.[0]?.id, nodes[4]!.id);
    }
  };
