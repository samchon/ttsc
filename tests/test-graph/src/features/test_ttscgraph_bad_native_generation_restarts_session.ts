import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a false native generation digest retires the whole child.
 *
 * A shard manifest can be internally consistent while the advertised generation
 * is false. Accepting that coordinate would let the next delta claim a base the
 * client never proved, so the transaction is rejected before publication and
 * the process is replaced.
 *
 * 1. Make the first fake process publish valid shards under a false generation.
 * 2. Assert the call rejects and that child exits.
 * 3. Assert the next call starts a replacement process and succeeds.
 */
export const test_ttscgraph_bad_native_generation_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "bad-shard-generation-once",
      requestTimeoutMs: 5_000,
    });
    try {
      await assert.rejects(
        session.graph(),
        /native generation wrong-generation/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "bad-generation child exit",
      );
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
