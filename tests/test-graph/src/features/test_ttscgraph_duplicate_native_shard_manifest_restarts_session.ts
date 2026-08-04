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
 * Locks the restart boundary after an already committed native generation. A
 * missing store reset would make the replacement child's sequence-one
 * transaction look stale even though it is the only trustworthy new base.
 *
 * 1. Commit one valid shard generation, then hide a second upsert behind a
 *    duplicate manifest key in the next delta.
 * 2. Reject the non-strict manifest and wait for the first child to exit.
 * 3. Start a clean child and accept its complete sequence-one shard generation.
 */
export const test_ttscgraph_duplicate_native_shard_manifest_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "duplicate-shard-manifest-once",
    });
    try {
      assert.deepEqual((await session.graph()).nodes, []);
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
