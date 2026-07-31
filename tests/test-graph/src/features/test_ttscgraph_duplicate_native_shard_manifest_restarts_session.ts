import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a duplicate manifest key cannot hide another committed shard.
 *
 * 1. Upsert two valid shards but describe the first one twice in the manifest.
 * 2. Reject the non-strict manifest and wait for the child to exit.
 * 3. Start a clean child and accept its complete initial generation.
 */
export const test_ttscgraph_duplicate_native_shard_manifest_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "duplicate-shard-manifest-once",
      requestTimeoutMs: 5_000,
    });
    try {
      await assert.rejects(
        session.graph(),
        /manifest must be strictly key-sorted/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "duplicate-manifest child exit",
      );
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
