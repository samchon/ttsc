import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies malformed native output retires the offending child before retry.
 *
 * A framing failure is session-wide, not one bad request. Keeping that child
 * reusable allows its later bytes to corrupt a new call, so the next request
 * must begin on a different process generation.
 *
 * 1. Make the first fake process answer with invalid JSON and stay alive.
 * 2. Assert the call rejects and the offending process is terminated.
 * 3. Assert a later call spawns a replacement and succeeds.
 */
export const test_ttscgraph_malformed_native_frame_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "malformed-once",
      requestTimeoutMs: 5_000,
    });
    try {
      await assert.rejects(session.graph(), /returned invalid JSON/);
      const firstPid = readPids(root)[0]!;
      await waitFor(() => !processIsAlive(firstPid), "malformed child exit");
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
