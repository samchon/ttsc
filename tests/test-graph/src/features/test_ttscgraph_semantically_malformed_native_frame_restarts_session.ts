import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies a response that contradicts its own mode retires the peer before recovery.
 *
 * The envelope is shape-valid (mode "initial", a full dump) but is flagged
 * changed: false, which the state's semantic checks must refuse. The peer that
 * sent it must be retired and the next request served from a fresh peer.
 *
 * 1. Start a graph request on a recorded line port and deliver an empty initial
 *    dump response whose changed flag is set to false.
 * 2. Require the rejection "an unchanged response carried changed mode or
 *    snapshot state" and the port to be retired (reader detached, then stdio joined).
 * 3. Request again, answer the second port with a valid empty full-dump response,
 *    and require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of an envelope with mode "initial", a dump body and changed set to false must reject graph() with "an unchanged response carried changed mode or snapshot state", retire the first port as close(false) then close(true) with live false, and a second graph() must open a second port and resolve to a model with no nodes.
 * @evidence contracts/testing.md#independent-expectations The contradiction (changed false beside mode initial and a dump) is authored by setting changed to false on an empty dump response, and the error pattern, the retirement sequence [false, true], the empty node list and the port count of two are literals; none is computed by the product's validation.
 * @evidence contracts/testing.md#distinguishing-cases The response differs from the accepted recovery reply only in its changed flag, so the semantic check is the one that fires rather than a schema or version check. The other contradictions (an error-mode response with a body, a changed response with no body or two bodies) are not exercised.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState, delivering a typed envelope to receive; TtscGraphProtocol.decode and a native process are not executed.
 */
export async function test_ttscgraph_semantically_malformed_native_frame_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    void active.catch(() => undefined);
    const port = await admitted(ports);
    const frame = emptyResponse(Number(port.writes[0]!.id));
    frame.changed = false;
    session.receive(port.peer, frame);
    await assert.rejects(active, /unchanged response carried changed mode or snapshot state/);
    assertRetired(port);

    const recovered = session.graph();
    void recovered.catch(() => undefined);
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { await session.close(); }
}
