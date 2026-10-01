import assert from "node:assert/strict";
import { admitted, emptyResponse, pendingCount, sessionState } from "./internal/sessionState";

/**
 * Verifies a response carrying an unknown request id is ignored and does not settle the live request.
 *
 * The state correlates replies by id. A frame whose id matches no pending
 * request, including one carrying a full graph, must leave the live request
 * pending, and the matching reply must then settle it, with an unchanged reply
 * reusing the resident model object.
 *
 * 1. Start a request, deliver a reply with id + 1000, and require one pending
 *    entry; then deliver the matching reply and require an empty node list.
 * 2. Start a second request, deliver another reply with an unknown id, require one
 *    pending entry, then deliver the matching unchanged reply.
 * 3. Require the second result to be the same object as the first, one opened port
 *    and no pending entries.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of an empty-dump reply whose id is the live request id plus 1000 must leave the pending count at 1 and the request unsettled, in both the first and the second request; the matching replies must then resolve the first request to an empty model and the second (unchanged) request to that same model object, with one port and zero pending entries.
 * @evidence contracts/testing.md#independent-expectations The id offset 1000, the pending counts 1 and 0, the object identity of the reused model and the single port are literals authored in the test, so accepting whichever frame arrives first would fail the pending count assertions.
 * @evidence contracts/testing.md#distinguishing-cases In each round the unknown-id reply precedes the matching one, with a changed (graph-bearing) unknown frame contrasted by the matching unchanged frame that must reuse the resident model. Duplicate replies for an already-settled id and replies from a retired peer are not exercised.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState, delivering typed envelopes to receive; TtscGraphProtocol.decode and a native process are not executed.
 */
export async function test_ttscgraph_unknown_native_response_id_does_not_settle_the_live_request(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const id = Number(port.writes[0]!.id);
    session.receive(port.peer, emptyResponse(id + 1_000));
    assert.equal(pendingCount(session), 1);
    session.receive(port.peer, emptyResponse(id));
    const first = await active;
    assert.deepEqual(first.nodes, []);
    const next = session.graph();
    await admitted(ports, 2);
    const secondId = Number(port.writes[1]!.id);
    session.receive(port.peer, emptyResponse(secondId + 1_000));
    assert.equal(pendingCount(session), 1);
    session.receive(port.peer, emptyResponse(secondId, false));
    assert.equal(await next, first, "unchanged response reuses resident memory");
    assert.equal(ports.length, 1);
    assert.equal(pendingCount(session), 0);
  } finally { session.close(); }
}
