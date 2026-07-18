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
 */
export const test_ttscgraph_resolver_ranks_member_fallback_before_limiting =
  () => {
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
  };
