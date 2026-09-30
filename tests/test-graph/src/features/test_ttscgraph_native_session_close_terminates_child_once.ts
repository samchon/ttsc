import {
  createNativeSessionFixture,
  pendingCount,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies closing a native session terminates outstanding work exactly once.
 *
 * Ending stdin alone is insufficient for a child that has stopped reading it.
 * Close must reject active work, terminate the process, remain idempotent, and
 * prevent any queued or later call from respawning an orphan.
 *
 * 1. Start a hanging graph request and count how often it settles.
 * 2. Close twice and assert one rejection plus direct child termination.
 * 3. Assert pending state is empty and calls after close cannot spawn again.
 *
 * @evidence contracts/testing.md#behavioral-verification Closing a session twice rejects active and queued requests once each, empties pending state, terminates the hanging child and forbids subsequent graph calls without respawning.
 * @evidence contracts/testing.md#independent-expectations Literal rejection patterns, independent settlement counters, pending count zero, dead PID and one-child log define idempotent close behavior beyond repeated calls alone.
 * @evidence contracts/testing.md#distinguishing-cases Active versus queued request errors, first versus second close, and post-close access distinguish terminal state from retryable retirement.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_native_session_close_terminates_child_once loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual child termination and queued/pending promise settlement must connect through close; an in-memory closed flag cannot establish kernel process retirement.
 * @evidence contracts/e2e.md#shared-execution The memoized Go stand-in is shared across native cases; this one deliberately retains a hanging child until close and needs its own terminal session. Cross-case batching is unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The case owns readiness/PID logs and calls close twice on its normal path. Unlike other helper users it has no enclosing finally, so an earlier readiness/assertion failure does not prove cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All original active/queued errors, exact settlement counts, pending-zero, dead-PID, post-close rejection and no-respawn assertions remain; the cleanup gap is documented, not repaired here.
 */
export const test_ttscgraph_native_session_close_terminates_child_once =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "hang",
    });
    let activeSettlements = 0;
    let queuedSettlements = 0;
    const active = session.graph().finally(() => {
      activeSettlements++;
    });
    const queued = session.graph().finally(() => {
      queuedSettlements++;
    });
    await waitFor(() => readPids(root).length === 1, "hanging child start");
    const pid = readPids(root)[0]!;
    session.close();
    session.close();
    await assert.rejects(active, /native session closed/);
    await assert.rejects(queued, /native session is closed/);
    await waitFor(() => !processIsAlive(pid), "closed child exit");
    assert.equal(activeSettlements, 1);
    assert.equal(queuedSettlements, 1);
    assert.equal(pendingCount(session), 0);
    await assert.rejects(session.graph(), /native session is closed/);
    assert.equal(readPids(root).length, 1);
  };
