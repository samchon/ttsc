import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies aborting an active native request retires and restarts its session.
 *
 * Cancellation cannot merely reject the caller while leaving the child alive:
 * that process can still emit the cancelled frame and its protocol position is
 * no longer trusted. The same reset path as timeout must be used.
 *
 * 1. Start a first-process-only hanging fake and wait until it is resident.
 * 2. Abort the active graph call and assert a cancellation error.
 * 3. Assert the old child exits and a later graph call succeeds on a replacement.
 */
export const test_ttscgraph_native_request_abort_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "hang-once",
      requestTimeoutMs: 10_000,
    });
    try {
      const controller = new AbortController();
      const cancelled = session.graph({ signal: controller.signal });
      await waitFor(() => readPids(root).length === 1, "first child start");
      const firstPid = readPids(root)[0]!;
      controller.abort({
        toString(): string {
          throw new Error("unprintable cancellation reason");
        },
      });
      await assert.rejects(cancelled, /native snapshot request cancelled/);
      await waitFor(() => !processIsAlive(firstPid), "cancelled child exit");
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
