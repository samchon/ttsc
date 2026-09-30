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
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession rejects a JSON frame that claims unchanged while supplying an initial dump, retires the child and successfully retries on a fresh child.
 * @evidence contracts/testing.md#independent-expectations The authored changed:false plus dump contradiction violates the response contract independently of JSON syntax; literal semantic rejection text distinguishes it from parse failure.
 * @evidence contracts/testing.md#distinguishing-cases Well-formed JSON with an impossible initial-state combination contrasts the valid replacement, preserving semantic validation beyond malformed JSON.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_semantically_malformed_native_frame_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real envelope validation, pending-request rejection and child restart must connect over stdio; the Go peer is a deterministic protocol stand-in.
 * @evidence contracts/e2e.md#shared-execution Native-session scenarios share one memoized peer build. This first semantic fault requires its cold child; replacement uses the same fixture, and full process-session minimization remains unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique marker/PID files preserve the invalid initial state; finally closes the session and explicit polling confirms the original process no longer lives.
 * @evidence contracts/e2e.md#preserved-coverage Semantic contradiction rejection, original PID death, recovered empty nodes and two-child count all remain; syntax-only coverage is not substituted.
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
