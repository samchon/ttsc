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
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession rejects invalid JSON from its first child, confirms that child terminated, then obtains an empty graph from one replacement.
 * @evidence contracts/testing.md#independent-expectations Deliberately non-JSON bytes and the literal invalid-JSON error are independent of parser output; PID death and count establish lifecycle consequence.
 * @evidence contracts/testing.md#distinguishing-cases Malformed first frame contrasts a valid next child, detecting both parse fail-closed behavior and restart without stale pending state.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_malformed_native_frame_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary An actual line written over child stdout must trigger parsing failure and retirement; the stand-in exercises framing and lifecycle, not native compiler graph extraction.
 * @evidence contracts/e2e.md#shared-execution One memoized Go peer artifact is shared by native cases. The first-only malformed mode requires a cold isolated session; recovery shares the fixture, and cross-case batching is incomplete.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Case-owned malformed marker and PID log prevent prior requests from warming away the fault; finally closes the session and explicit polling observes old-child death.
 * @evidence contracts/e2e.md#preserved-coverage Original invalid-JSON rejection, first PID termination, empty recovered graph and exactly two-child assertions remain.
 */
export const test_ttscgraph_malformed_native_frame_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "malformed-once",
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
