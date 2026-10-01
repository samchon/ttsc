import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies a non-JSON line from the native peer rejects the request and retires the peer before recovery.
 *
 * The state hands each received line to its host decoder; an unparseable line
 * must fail the active request and retire the peer rather than being ignored.
 *
 * 1. Start a graph request on a recorded line port and emit the line "not-json".
 * 2. Require the request to reject with the invalid-JSON error and the port to be
 *    retired (reader detached, then stdio joined).
 * 3. Request again, answer the second port with an empty full-dump response, and
 *    require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification Emitting the line "not-json" through the port's events runs the real TtscGraphProtocol.decode, which must make graph() reject with "returned invalid JSON", retire the first port as close(false) then close(true), and a second graph() must open a second port and resolve to a model with no nodes.
 * @evidence contracts/testing.md#independent-expectations The non-JSON line, the expected error pattern, the retirement sequence [false, true], the empty node list and the port count of two are literals; the recovery reply is an empty dump built by emptyResponse. Only the JSON.parse failure is reached, so protocol-version and envelope-shape validation are not exercised.
 * @evidence contracts/testing.md#distinguishing-cases A single malformed frame (not a protocol-version mismatch or a schema violation) fails the whole session, contrasted with the valid reply accepted from the replacement port.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState with TtscGraphProtocol.decode in the test process against the recorded line ports of internal/sessionState; no native process is started and the typia envelope validation is not reached.
 */
export async function test_ttscgraph_malformed_native_frame_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    port.events.line("not-json");
    await assert.rejects(active, /returned invalid JSON/);
    assertRetired(port);

    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
