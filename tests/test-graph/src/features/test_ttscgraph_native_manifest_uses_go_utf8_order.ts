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
 */
export const test_ttscgraph_native_manifest_uses_go_utf8_order = async () => {
  const { session } = createNativeSessionFixture({
    mode: "unicode-shard-manifest",
    requestTimeoutMs: 5_000,
  });
  try {
    const graph = await session.graph();
    assert.deepEqual(graph.nodes, []);
  } finally {
    session.close();
  }
};
