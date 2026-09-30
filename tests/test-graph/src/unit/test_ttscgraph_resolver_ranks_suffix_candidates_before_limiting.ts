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
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle asserts Inner.run ranks the late exported suffix match first within twelve results.
 * @evidence contracts/testing.md#independent-expectations All qualified names end in Inner.run; the only exported method is independently preferred.
 * @evidence contracts/testing.md#distinguishing-cases Thirteen outer owners with the winner last distinguish suffix ranking from exact-name and member fallback.
 * @evidence contracts/testing.md#execution-ownership The named exported src/unit entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
 */
export function test_ttscgraph_resolver_ranks_suffix_candidates_before_limiting(): void {
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
}
