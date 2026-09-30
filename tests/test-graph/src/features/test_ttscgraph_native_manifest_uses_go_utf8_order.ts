import { createNativeSessionFixture } from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies native shard manifests use the producer's UTF-8 ordering.
 *
 * Go orders strings by UTF-8 bytes while JavaScript's relational operators use
 * UTF-16 code units. A BMP private-use key and a supplementary key reverse
 * those orders, so this pair pins the cross-language protocol comparator.
 *
 * 1. Publish two valid empty shards sorted by the Go producer.
 * 2. Place U+E000 before U+10000 in that manifest.
 * 3. Accept the generation without treating the valid order as malformed.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession accepts the stand-in's valid manifest ordered by Go UTF-8 byte comparison, including U+E000 before U+10000, and returns empty nodes.
 * @evidence contracts/testing.md#independent-expectations The two literal Unicode keys independently distinguish UTF-8 order from JavaScript UTF-16 order; successful acceptance is the oracle, not a client-generated expected sort.
 * @evidence contracts/testing.md#distinguishing-cases A valid order that reverses UTF-16 lexical preference guards against a JavaScript sorting substitution. Invalid ordering is owned by the duplicate-manifest case.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_native_manifest_uses_go_utf8_order loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real Go-encoded keys, digests and generation identity cross stdio into session shard validation; synthetic JavaScript sorting alone cannot certify that language boundary.
 * @evidence contracts/e2e.md#shared-execution The memoized Go protocol peer is shared across native cases; this mode needs only one child and immutable manifest. Cross-case session batching remains unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned Unicode manifest/config and a fresh session prevent cached ASCII-only snapshots from bypassing validation; finally closes its session.
 * @evidence contracts/e2e.md#preserved-coverage Original successful graph acceptance and empty-node assertion remain. This is a positive cross-language ordering case and does not independently test every invalid Unicode order.
 */
export const test_ttscgraph_native_manifest_uses_go_utf8_order = async () => {
  const { session } = createNativeSessionFixture({
    mode: "unicode-shard-manifest",
  });
  try {
    const graph = await session.graph();
    assert.deepEqual(graph.nodes, []);
  } finally {
    session.close();
  }
};
