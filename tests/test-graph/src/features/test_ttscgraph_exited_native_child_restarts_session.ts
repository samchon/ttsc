import assert from "node:assert/strict";
import { admitted, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies a native exit event rejects the active request and retires the peer before recovery.
 *
 * An exit event must reject the pending request, detach the reader and request
 * stdio joining, and the next request must open a new peer.
 *
 * 1. Start a graph request on a recorded line port, mark the port dead and emit
 *    exit(17, null).
 * 2. Require the request to reject with the session-exited error and the port to
 *    record close(false) then close(true).
 * 3. Request again, answer the second port with an empty full-dump response, and
 *    require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification An exit(17, null) event delivered to the session's events must reject the pending graph() request, record port close(false) then close(true), and a second graph() must open a second port and resolve to a model with no nodes. The rejection message must carry the exit code and signal literally, "native session exited (code=17, signal=null)".
 * @evidence contracts/testing.md#independent-expectations The exit event with code 17 is the authored stimulus; the accepted error pattern, the retirement sequence [false, true], the empty node list and the port count of two are literals, and the recovery reply is an empty dump built by emptyResponse.
 * @evidence contracts/testing.md#distinguishing-cases The retirement sequence ends with close(true) even though the process already exited, so the stdio join is requested rather than assumed complete; the replacement port answering normally contrasts the failed first port. Signal exits, exits after a response and write failures are not exercised.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState. No line is decoded and no native process, generated schema validator or kernel exit is involved.
 */
export async function test_ttscgraph_exited_native_child_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    void active.catch(() => undefined);
    const port = await admitted(ports);
    port.live = false;
    port.events.exit(17, null);
    await assert.rejects(active, /native session exited \(code=17, signal=null\)/);
    assert.deepEqual(port.retirement, [false, true]);

    const recovered = session.graph();
    void recovered.catch(() => undefined);
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { await session.close(); }
}
