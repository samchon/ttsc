import {
  createNativeSessionFixture,
  pendingCount,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a silent native request times out and the queued call restarts.
 *
 * A child that accepts stdin without answering used to hold the serialized
 * graph queue forever. The timeout must retire that child, include its recent
 * stderr, and leave the next queued call free to create a clean session.
 *
 * 1. Start a fake child that stalls only on its first process.
 * 2. Queue two graph calls and assert the first times out with diagnostics.
 * 3. Assert the first process dies, pending state clears, and the queued call
 *    succeeds on a replacement.
 */
export const test_ttscgraph_native_request_timeout_restarts_queued_call =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "hang-once",
      requestTimeoutMs: 1_000,
      stderr: "compiler fixture reached its deliberate stall",
    });
    try {
      const first = session.graph();
      const second = session.graph();
      await assert.rejects(
        first,
        (error: Error) =>
          /timed out after 1000 ms/.test(error.message) &&
          /deliberate stall/.test(error.message),
      );
      await waitFor(() => readPids(root).length === 2, "replacement child");
      const pids = readPids(root);
      await waitFor(() => !processIsAlive(pids[0]!), "timed-out child exit");
      const graph = await second;
      assert.deepEqual(graph.nodes, []);
      assert.equal(pendingCount(session), 0);
    } finally {
      session.close();
    }
  };
