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
 */
export const test_ttscgraph_resolver_ranks_stale_id_fallback_before_limiting =
  () => {
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
  };
