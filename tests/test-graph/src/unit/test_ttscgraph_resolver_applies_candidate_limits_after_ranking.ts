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
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle asserts candidate lengths and the last exported winner across every nonempty limit.
 * @evidence contracts/testing.md#independent-expectations Exported declarations outrank equivalent local ones; literal lengths follow five inputs capped at zero, one, three, five or eight.
 * @evidence contracts/testing.md#distinguishing-cases Zero, small, exact and oversized limits distinguish payload capping from premature search truncation.
 * @evidence contracts/testing.md#execution-ownership The named exported src/unit entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
 */
export function test_ttscgraph_resolver_applies_candidate_limits_after_ranking(): void {
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
}
