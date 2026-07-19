import {
  createNativeSessionFixture,
  delay,
  pendingCount,
  processIsAlive,
  readPids,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a normal response clears its watchdog and ignores unknown IDs.
 *
 * A stale timer would kill a healthy resident compiler after a successful
 * response. An unrelated response ID is also not authority to settle the live
 * request, but must be harmless when the matching frame follows.
 *
 * 1. Make the fake emit an unknown response ID before its matching response.
 * 2. Wait beyond the configured deadline after the successful graph call.
 * 3. Assert the same child remains alive and answers a second call with no pending
 *    leak.
 */
export const test_ttscgraph_native_request_response_clears_watchdog =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "unknown-then-respond",
      requestTimeoutMs: 500,
    });
    try {
      const first = await session.graph();
      assert.deepEqual(first.nodes, []);
      const pid = readPids(root)[0]!;
      await delay(750);
      assert.equal(
        processIsAlive(pid),
        true,
        "cleared timer keeps child alive",
      );
      const second = await session.graph();
      assert.equal(second, first, "unchanged response reuses resident memory");
      assert.equal(readPids(root).length, 1);
      assert.equal(pendingCount(session), 0);
    } finally {
      session.close();
    }
  };
