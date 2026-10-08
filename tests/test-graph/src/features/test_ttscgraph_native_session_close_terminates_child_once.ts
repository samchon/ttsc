import assert from "node:assert/strict";

import { admitted, assertRetired, sessionState } from "./internal/sessionState";

/**
 * Verifies closing a session twice settles its active and queued requests once
 * and retires the peer once.
 *
 * Close is terminal and idempotent: it must reject the request in flight and
 * the one queued behind it, close the host once, and refuse any later request
 * without opening another peer.
 *
 * 1. Issue two graph requests (one active on the recorded port, one queued),
 *    counting each settlement.
 * 2. Call close twice, then require the active and queued rejections, one
 *    settlement each and one retirement of the port.
 * 3. Require a later graph() to reject as closed, no second port, and one host
 *    close call.
 *
 * @evidence contracts/testing.md#behavioral-verification Calling session.close() twice returns the same completion, rejects the active request with "native session closed" and the queued one with "native session is closed", retires the port as close(false) then close(true), runs each request's finally exactly once, rejects a later graph() and calls the host close once.
 * @evidence contracts/testing.md#independent-expectations Settlement counters observe returned Promises. Expected error patterns, retirement sequence [false, true], port count 1 and host close count 1 are literals; no private pending map is read.
 * @evidence contracts/testing.md#distinguishing-cases The active and queued requests fail with different messages (peer closed versus session closed), and the doubled close and the post-close request contrast the first close; reopening after close and a close while idle are not exercised.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState. No line is decoded and no native process or kernel termination is involved.
 */
export async function test_ttscgraph_native_session_close_terminates_child_once(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    let activeSettlements = 0;
    let queuedSettlements = 0;
    const active = session.graph().finally(() => {
      activeSettlements++;
    });
    void active.catch(() => undefined);
    const port = await admitted(ports);
    const queued = session.graph().finally(() => {
      queuedSettlements++;
    });
    void queued.catch(() => undefined);
    const closing = session.close();
    assert.equal(session.close(), closing);
    await assert.rejects(active, /native session closed/);
    await assert.rejects(queued, /native session is closed/);
    await closing;
    assertRetired(port);
    assert.equal(activeSettlements, 1);
    assert.equal(queuedSettlements, 1);
    await assert.rejects(session.graph(), /native session is closed/);
    assert.equal(ports.length, 1);
    assert.equal(fixture.closed(), 1);
  } finally {
    await session.close();
  }
}
