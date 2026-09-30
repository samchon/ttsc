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
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession rejects the request when the first Go peer exits, then returns an empty graph after starting a replacement child.
 * @evidence contracts/testing.md#independent-expectations The peer's deliberate exit and literal acceptable exit/request error patterns provide an independent failure stimulus; the observed two PIDs distinguish replacement from a stale result.
 * @evidence contracts/testing.md#distinguishing-cases Immediate first exit contrasts successful replacement. Either allowed error wording reflects the race between request write and child exit, without weakening the required rejection.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_exited_native_child_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real child-exit events and request settlement must trigger restart through the session; an in-memory rejected promise cannot certify process recovery.
 * @evidence contracts/e2e.md#shared-execution The nativeSession helper builds its stand-in once for all protocol cases. A fresh first-only-exit child is necessary here; the next request shares the project, and broader batching is unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique marker and PID log isolate the first exit; finally closes the session and two PIDs are awaited. This case does not separately assert old-PID liveness after the exit.
 * @evidence contracts/e2e.md#preserved-coverage Original rejection alternatives, empty recovered nodes and two-child observation remain; no fake successful response replaces the exited peer.
 */
export const test_ttscgraph_exited_native_child_restarts_session = async () => {
  const { root, session } = createNativeSessionFixture({
    mode: "exit-once",
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
