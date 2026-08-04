import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a native shard digest disagreement retires the whole child.
 *
 * A transaction is atomic only if an invalid replacement cannot become the base
 * of the next request. The client must discard that process generation, then
 * accept a complete generation from a fresh child.
 *
 * 1. Make the first fake process publish one shard under a false digest.
 * 2. Assert the call rejects and that child exits.
 * 3. Assert the next call starts a replacement process and succeeds.
 */
export const test_ttscgraph_bad_native_shard_digest_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "bad-shard-digest-once",
    });
    try {
      await assert.rejects(
        session.graph(),
        /digest wrong-digest does not match/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(() => !processIsAlive(firstPid), "bad-shard child exit");
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
