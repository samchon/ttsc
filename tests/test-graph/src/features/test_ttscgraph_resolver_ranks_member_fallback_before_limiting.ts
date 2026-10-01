import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver ranking: value-member fallback ranks the complete member
 * set.
 *
 * Calls such as `client.run` have no graph node for the runtime receiver, so
 * the resolver finally searches the member name `run`. That recovery must
 * consider every declaring type rather than the first twelve methods indexed.
 *
 * 1. Build thirteen owner-qualified `run` methods with the winner last.
 * 2. Resolve the value-shaped handle `client.run`.
 * 3. Assert fallback returns the late exported method first within the cap.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle asserts client.run recovers all matching members and ranks the late exported method first.
 * @evidence contracts/testing.md#independent-expectations Runtime receiver spelling may recover member candidates without a receiver node; exported relevance supplies the winner.
 * @evidence contracts/testing.md#distinguishing-cases Thirteen owner-qualified methods with an absent client receiver distinguish final member fallback.
 * @evidence contracts/testing.md#execution-ownership The named exported src/features entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
 */
export function test_ttscgraph_resolver_ranks_member_fallback_before_limiting(): void {
    const nodes: ResolverGraphNode[] = Array.from(
      { length: 13 },
      (_, index) => ({
        id: `src/service-${String(index).padStart(2, "0")}.ts#Service${String(index)}.run:method`,
        kind: "method",
        name: "run",
        qualifiedName: `Service${String(index)}.run`,
        file: `src/service-${String(index).padStart(2, "0")}.ts`,
        external: false,
        ...(index === 12 ? { exported: true } : {}),
      }),
    );

    const resolved = resolveSyntheticGraph(nodes, "client.run");
    assert.strictEqual(resolved.candidates?.length, 12);
    assert.strictEqual(resolved.candidates?.[0]?.id, nodes[12]!.id);
}
