import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver ranking: file-qualified candidates are scored before
 * limiting.
 *
 * A repeated file stem can still be ambiguous across package directories. The
 * file-qualified branch previously sliced that list independently, so its best
 * declaration could disappear even though ranking knew it was exported.
 *
 * 1. Build thirteen `shared.ts` files that each declare `Thing`.
 * 2. Place the exported declaration last in graph order.
 * 3. Assert `shared.Thing` returns that candidate first within the limit.
 */
export const test_ttscgraph_resolver_ranks_file_qualified_candidates_before_limiting =
  () => {
    const nodes: ResolverGraphNode[] = Array.from(
      { length: 13 },
      (_, index) => ({
        id: `packages/p${String(index)}/shared.ts#Thing:class`,
        kind: "class",
        name: "Thing",
        file: `packages/p${String(index)}/shared.ts`,
        external: false,
        ...(index === 12 ? { exported: true } : {}),
      }),
    );

    const resolved = resolveSyntheticGraph(nodes, "shared.Thing");
    assert.strictEqual(resolved.candidates?.length, 12);
    assert.strictEqual(resolved.candidates?.[0]?.id, nodes[12]!.id);
  };
