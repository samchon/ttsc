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
 */
export const test_ttscgraph_native_session_close_terminates_child_once =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "hang",
      requestTimeoutMs: 10_000,
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
