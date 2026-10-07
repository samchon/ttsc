import assert from "node:assert/strict";

import { admitted, sessionState } from "./internal/sessionState";

/**
 * Verifies aborting a queued request rejects it at once and leaves the active
 * peer running.
 *
 * With one request outstanding on the peer, a second request is queued.
 * Aborting the queued request must reject it without waiting for the first
 * request and without retiring the peer.
 *
 * 1. Start a request and wait for its write, then queue a second request with an
 *    AbortSignal and abort it.
 * 2. Require the queued request to settle by the next event turn with the
 *    cancellation error while the unanswered head stays pending and its port
 *    stays live.
 * 3. Close the session and require the first request to reject as closed.
 *
 * @evidence contracts/testing.md#behavioral-verification Aborting a queued graph() request must settle it by the next event turn with "native snapshot request cancelled" while the unanswered head stays pending. The peer remains live with one write and one port; close then rejects the head with "native session closed".
 * @evidence contracts/testing.md#independent-expectations No head reply is sent. Promise callbacks observed after setImmediate drains reaction microtasks distinguish queued cancellation from waiting behind the head, without a wall-clock bound. The live flag and write/port counts of one are authored literals.
 * @evidence contracts/testing.md#distinguishing-cases Cancelling a queued request (the peer stays live, no retirement) contrasts cancelling an active one, covered by the active-abort test; the first request staying pending until close contrasts the immediately rejected one.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState. No line is decoded and no native process is involved.
 */
export async function test_ttscgraph_queued_native_request_can_abort_before_start(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    let headSettled = false;
    const head = session.graph();
    void head.then(
      () => {
        headSettled = true;
      },
      () => {
        headSettled = true;
      },
    );
    const port = await admitted(ports);
    const controller = new AbortController();
    let queuedSettled = false;
    const queued = session.graph({ signal: controller.signal });
    void queued.then(
      () => {
        queuedSettled = true;
      },
      () => {
        queuedSettled = true;
      },
    );
    controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(queuedSettled, true);
    assert.equal(headSettled, false);
    await assert.rejects(queued, /native snapshot request cancelled/);
    assert.equal(port.live, true);
    assert.equal(ports.length, 1);
    assert.equal(port.writes.length, 1);
    const closing = session.close();
    await assert.rejects(head, /native session closed/);
    await closing;
  } finally {
    await session.close();
  }
}
