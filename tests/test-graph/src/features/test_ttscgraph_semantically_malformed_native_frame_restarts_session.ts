import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a shape-valid frame with contradictory state retires its child.
 *
 * 1. Return `changed: false` together with an initial dump.
 * 2. Reject that semantic contradiction and wait for the child to exit.
 * 3. Start a clean child and accept its complete initial generation.
 */
export const test_ttscgraph_semantically_malformed_native_frame_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "bad-envelope-once",
    });
    try {
      await assert.rejects(
        session.graph(),
        /unchanged response carried changed mode or snapshot state/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "semantically malformed child exit",
      );
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
