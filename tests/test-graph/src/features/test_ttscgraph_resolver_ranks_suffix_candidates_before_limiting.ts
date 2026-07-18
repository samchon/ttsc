import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver ranking: qualified suffix candidates are scored before
 * limiting.
 *
 * Suffix matching has its own candidate producer, and it carried the same early
 * truncation as exact names. Fixing only the common-name witness would leave
 * nested declarations dependent on graph traversal order.
 *
 * 1. Build thirteen methods whose qualified names end in `Inner.run`.
 * 2. Put the only exported method after the response limit.
 * 3. Assert suffix resolution ranks that method first before returning twelve.
 */
export const test_ttscgraph_resolver_ranks_suffix_candidates_before_limiting =
  () => {
    const nodes: ResolverGraphNode[] = Array.from(
      { length: 13 },
      (_, index) => ({
        id: `src/suffix-${String(index).padStart(2, "0")}.ts#Outer${String(index)}.Inner.run:method`,
        kind: "method",
        name: "run",
        qualifiedName: `Outer${String(index)}.Inner.run`,
        file: `src/suffix-${String(index).padStart(2, "0")}.ts`,
        external: false,
        ...(index === 12 ? { exported: true } : {}),
      }),
    );

    const resolved = resolveSyntheticGraph(nodes, "Inner.run");
    assert.strictEqual(resolved.candidates?.length, 12);
    assert.strictEqual(resolved.candidates?.[0]?.id, nodes[12]!.id);
  };
