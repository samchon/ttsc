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
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle asserts shared.Thing ranks the thirteenth exported declaration first under the cap.
 * @evidence contracts/testing.md#independent-expectations The handle admits repeated shared.ts declarations; the only exported declaration is the independent winner.
 * @evidence contracts/testing.md#distinguishing-cases Thirteen repeated file stems in different packages expose truncation before file-qualified ranking.
 * @evidence contracts/testing.md#execution-ownership The named exported src/features entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
 */
export function test_ttscgraph_resolver_ranks_file_qualified_candidates_before_limiting(): void {
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
}
