import assert from "node:assert/strict";
import { admitted, sessionState } from "./internal/sessionState";

/**
 * Verifies aborting a queued request rejects it at once and leaves the active peer running.
 *
 * With one request outstanding on the peer, a second request is queued. Aborting
 * the queued request must reject it without waiting for the first request and
 * without retiring the peer.
 *
 * 1. Start a request and wait for its write, then queue a second request with an
 *    AbortSignal and abort it.
 * 2. Require the queued request to reject with the cancellation error within one
 *    second while the port is still live with one write and one port opened.
 * 3. Close the session and require the first request to reject as closed.
 *
 * @evidence contracts/testing.md#behavioral-verification Aborting a queued graph() request while the first request is outstanding must reject it with "native snapshot request cancelled" in under one second, leave port.live true with one recorded write and one opened port, and a later session.close() must reject the first request with "native session closed".
 * @evidence contracts/testing.md#independent-expectations The outstanding first request (no reply is ever sent), the one-second bound, the live flag and the write and port counts of one are literals; waiting behind the unanswered head would never settle, so the rejection can only come from queued cancellation.
 * @evidence contracts/testing.md#distinguishing-cases Cancelling a queued request (the peer stays live, no retirement) contrasts cancelling an active one, covered by the active-abort test; the first request staying pending until close contrasts the immediately rejected one.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState. No line is decoded and no native process is involved.
 */
export async function test_ttscgraph_queued_native_request_can_abort_before_start(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const head = session.graph();
    const port = await admitted(ports);
    const controller = new AbortController();
    const started = Date.now();
    const queued = session.graph({ signal: controller.signal });
    controller.abort();
    await assert.rejects(queued, /native snapshot request cancelled/);
    assert.ok(Date.now() - started < 1_000, "queued cancellation is immediate");
    assert.equal(port.live, true);
    assert.equal(ports.length, 1);
    assert.equal(port.writes.length, 1);
    session.close();
    await assert.rejects(head, /native session closed/);
  } finally { session.close(); }
}
