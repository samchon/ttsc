import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies duplicate universe inputs cannot conceal an undeclared config shard.
 *
 * Locks the config-coverage check as a bijection instead of two same-sized
 * collections. Otherwise one repeated config can balance one hidden input.
 *
 * 1. Publish two config shards but describe the first input twice in universe.
 * 2. Reject the non-bijective coverage and wait for the child to exit.
 * 3. Start a clean child and accept its complete initial generation.
 */
export const test_ttscgraph_duplicate_native_config_universe_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "duplicate-config-universe-once",
      requestTimeoutMs: 5_000,
    });
    try {
      await assert.rejects(
        session.graph(),
        /config shard disagrees with universe input tsconfig\.json/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "duplicate-config child exit",
      );
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
