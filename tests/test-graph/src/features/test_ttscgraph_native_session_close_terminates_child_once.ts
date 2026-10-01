import assert from "node:assert/strict";
import { admitted, assertRetired, pendingCount, sessionState } from "./internal/sessionState";

/**
 * Verifies closing a session twice settles its active and queued requests once and retires the peer once.
 *
 * Close is terminal and idempotent: it must reject the request in flight and the
 * one queued behind it, leave no pending entry, close the host once, and refuse
 * any later request without opening another peer.
 *
 * 1. Issue two graph requests (one active on the recorded port, one queued),
 *    counting each settlement.
 * 2. Call close twice, then require the active and queued rejections, one
 *    settlement each, one retirement of the port and no pending entries.
 * 3. Require a later graph() to reject as closed, no second port, and one host
 *    close call.
 *
 * @evidence contracts/testing.md#behavioral-verification Calling session.close() twice must reject the active request with "native session closed" and the queued one with "native session is closed", retire the port as close(false) then close(true), run each request's finally exactly once, leave zero pending entries, reject a later graph() and call the host close once.
 * @evidence contracts/testing.md#independent-expectations The settlement counters, the expected error patterns, the retirement sequence [false, true], the pending count 0, the port count 1 and the host close count 1 are literals authored in the test, not derived from the state's own bookkeeping.
 * @evidence contracts/testing.md#distinguishing-cases The active and queued requests fail with different messages (peer closed versus session closed), and the doubled close and the post-close request contrast the first close; reopening after close and a close while idle are not exercised.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState. No line is decoded and no native process or kernel termination is involved.
 */
export async function test_ttscgraph_native_session_close_terminates_child_once(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    let activeSettlements = 0;
    let queuedSettlements = 0;
    const active = session.graph().finally(() => { activeSettlements++; });
    const queued = session.graph().finally(() => { queuedSettlements++; });
    const port = await admitted(ports);
    session.close(); session.close();
    await assert.rejects(active, /native session closed/);
    await assert.rejects(queued, /native session is closed/);
    assertRetired(port);
    assert.equal(activeSettlements, 1);
    assert.equal(queuedSettlements, 1);
    assert.equal(pendingCount(session), 0);
    await assert.rejects(session.graph(), /native session is closed/);
    assert.equal(ports.length, 1);
    assert.equal(fixture.closed(), 1);
  } finally { session.close(); }
}
