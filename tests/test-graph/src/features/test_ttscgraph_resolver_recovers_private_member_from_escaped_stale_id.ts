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
 * 1. Build one node whose id escapes the hash of its private name (qualified name
 *    Counter.#count).
 * 2. Resolve the same escaped id under an obsolete file.
 * 3. Assert the resolver returns that node.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveGraphHandle for the handle "src/old.ts#Counter.\#count:variable" must resolve uniquely to the node whose id is "src/current.ts#Counter.\#count:variable" and qualifiedName "Counter.#count".
 * @evidence contracts/testing.md#independent-expectations The id grammar quotes a hash inside a name as \#, so the decoded symbol is Counter.#count; the escaped handle, the obsolete file and the expected node id are literals written in the test.
 * @evidence contracts/testing.md#distinguishing-cases The handle names an obsolete file, so the direct id lookup misses and only the stale-id fallback can succeed; cutting the id at the escaped hash would look up a different symbol and miss. Only one private member is used, and the dump holds no owning class for it.
 * @evidence contracts/testing.md#execution-ownership Calls TtscGraphMemory.from and resolveGraphHandle through resolveSyntheticGraph in the test process with typed in-memory nodes; no installed consumer, native producer or process is involved.
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
