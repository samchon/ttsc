import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver ranking: stale-id fallback ranks the complete symbol set.
 *
 * A stale `file#symbol:kind` handle falls back to its symbol portion after the
 * direct id misses. That recovery reuses exact-name resolution and must not
 * inherit a pre-ranked prefix that omits the strongest current declaration.
 *
 * 1. Build thirteen current declarations named `Moved` with the winner last.
 * 2. Resolve an id whose old file no longer exists.
 * 3. Assert the recovered ambiguity starts with the late exported declaration.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle asserts an obsolete file id recovers Moved and ranks the late exported declaration first.
 * @evidence contracts/testing.md#independent-expectations The stale-id contract preserves the authored symbol when the old file is absent; exported relevance supplies the winner.
 * @evidence contracts/testing.md#distinguishing-cases An obsolete file and thirteen current declarations distinguish recovery from direct-id success and early capping.
 * @evidence contracts/testing.md#execution-ownership The named exported src/features entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
 */
export function test_ttscgraph_resolver_ranks_stale_id_fallback_before_limiting(): void {
    const nodes: ResolverGraphNode[] = Array.from(
      { length: 13 },
      (_, index) => ({
        id: `src/current-${String(index).padStart(2, "0")}.ts#Moved:class`,
        kind: "class",
        name: "Moved",
        file: `src/current-${String(index).padStart(2, "0")}.ts`,
        external: false,
        ...(index === 12 ? { exported: true } : {}),
      }),
    );

    const resolved = resolveSyntheticGraph(nodes, "src/old.ts#Moved:class");
    assert.strictEqual(resolved.candidates?.length, 12);
    assert.strictEqual(resolved.candidates?.[0]?.id, nodes[12]!.id);
}
