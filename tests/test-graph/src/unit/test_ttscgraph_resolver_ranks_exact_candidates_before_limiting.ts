import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver ranking: exact-name candidates are scored before limiting.
 *
 * The exact-name branch used to discard every node after the first twelve
 * before the exported-symbol score ran, so compiler visitation order could hide
 * the strongest match from every consumer.
 *
 * 1. Build thirteen exact-name candidates with the exported winner last.
 * 2. Resolve the shared name with the default twelve-candidate limit.
 * 3. Assert the late winner is returned first and the response stays capped.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle asserts the thirteenth exact-name declaration first and twelve returned candidates.
 * @evidence contracts/testing.md#independent-expectations The only exported declaration outranks otherwise equivalent local candidates regardless of visitation.
 * @evidence contracts/testing.md#distinguishing-cases Thirteen exact-name candidates place the winner beyond the default twelve-item cap.
 * @evidence contracts/testing.md#execution-ownership The named exported src/unit entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
 */
export function test_ttscgraph_resolver_ranks_exact_candidates_before_limiting(): void {
    const nodes: ResolverGraphNode[] = Array.from(
      { length: 13 },
      (_, index) => ({
        id: `src/exact-${String(index).padStart(2, "0")}.ts#Shared:class`,
        kind: "class",
        name: "Shared",
        file: `src/exact-${String(index).padStart(2, "0")}.ts`,
        external: false,
        ...(index === 12 ? { exported: true } : {}),
      }),
    );

    const resolved = resolveSyntheticGraph(nodes, "Shared");
    assert.strictEqual(resolved.candidates?.length, 12);
    assert.strictEqual(resolved.candidates?.[0]?.id, nodes[12]!.id);
}
