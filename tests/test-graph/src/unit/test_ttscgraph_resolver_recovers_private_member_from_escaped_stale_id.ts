import assert from "node:assert/strict";

import {
  type ResolverGraphNode,
  resolveSyntheticGraph,
} from "../internal/resolverGraph";

/**
 * Verifies resolver identity: an escaped private-member stale id recovers its
 * authored `Counter.#count` name.
 *
 * The final `#` in a private member is data, not a second id boundary. The
 * stale-id fallback must decode the producer's escaped name before consulting
 * the structured symbol index.
 *
 * 1. Build the current private property under its escaped graph id.
 * 2. Resolve an escaped id from an obsolete file.
 * 3. Assert recovery returns the current private member.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle asserts the current private property identity from an obsolete escaped id.
 * @evidence contracts/testing.md#independent-expectations Graph id grammar treats the escaped hash as private-member data, preserving Counter.#count.
 * @evidence contracts/testing.md#distinguishing-cases An escaped private property under an obsolete file distinguishes data decoding from a second hash boundary.
 * @evidence contracts/testing.md#execution-ownership The named exported src/unit entry executes authored graph memory and resolver through the unit loader; no installed consumer, native producer or child process is used.
 */
export function test_ttscgraph_resolver_recovers_private_member_from_escaped_stale_id(): void {
    const node: ResolverGraphNode = {
      id: "src/current.ts#Counter.\\#count:variable",
      kind: "variable",
      name: "#count",
      qualifiedName: "Counter.#count",
      file: "src/current.ts",
      external: false,
    };
    const resolved = resolveSyntheticGraph(
      [node],
      "src/old.ts#Counter.\\#count:variable",
    );
    assert.strictEqual(resolved.node?.id, node.id);
}
