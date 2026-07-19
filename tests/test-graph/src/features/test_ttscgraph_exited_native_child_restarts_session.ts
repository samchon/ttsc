import {
  createNativeSessionFixture,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies an early native child exit does not poison later graph requests.
 *
 * The process can exit before or while Node completes the stdin write callback.
 * Both event orderings must settle the same pending owner once and leave the
 * serialized queue able to spawn a new process.
 *
 * 1. Make the first fake process exit with a non-zero status before responding.
 * 2. Assert the first graph call rejects through the child/write failure boundary.
 * 3. Assert a later call starts a second process and returns a graph.
 */
export const test_ttscgraph_exited_native_child_restarts_session = async () => {
  const { root, session } = createNativeSessionFixture({
    mode: "exit-once",
    requestTimeoutMs: 5_000,
  });
  try {
    await assert.rejects(
      session.graph(),
      /native session exited|could not request native snapshot/,
    );
    const graph = await session.graph();
    assert.deepEqual(graph.nodes, []);
    await waitFor(() => readPids(root).length === 2, "replacement after exit");
  } finally {
    session.close();
  }
};
