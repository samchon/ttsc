import assert from "node:assert/strict";
import { admitted, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies a response carrying an unknown request id is ignored and does not settle the live request.
 *
 * The state correlates replies by id. A frame whose id matches no pending
 * request, including one carrying a full graph, must leave the live request
 * pending, and the matching reply must then settle it, with an unchanged reply
 * reusing the resident model object.
 *
 * 1. Start a request, deliver a reply with id + 1000, and require its returned
 *    Promise to stay unsettled through an event turn; then deliver its reply.
 * 2. Start a second request and deliver the settled first id and another unknown
 *    id, requiring it to stay unsettled after each, then deliver its reply.
 * 3. Require the second result to be the same object as the first, one opened port
 *    and an empty first node list.
 *
 * @evidence contracts/testing.md#behavioral-verification Unknown id + 1000 and a duplicate settled id must leave the live graph() Promise unsettled through an event turn. Matching replies resolve the first request to an empty model and the unchanged second request to that same model object, with one port.
 * @evidence contracts/testing.md#independent-expectations Authored ids and empty model expectations follow the correlation contract. Promise callbacks observe settlement after setImmediate lets reaction microtasks drain; no private pending map is read. Accepting an unknown response would settle the Promise before that observation.
 * @evidence contracts/testing.md#distinguishing-cases In each round the unknown-id reply precedes the matching one, with a changed (graph-bearing) unknown frame contrasted by the matching unchanged frame that must reuse the resident model. A duplicate response for the settled first id also leaves the second request pending. Replies from a retired peer are not exercised.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState directly in the test process against the recorded line ports of internal/sessionState, delivering typed envelopes to receive; TtscGraphProtocol.decode and a native process are not executed.
 */
export async function test_ttscgraph_unknown_native_response_id_does_not_settle_the_live_request(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    let activeSettled = false;
    const active = session.graph();
    void active.then(() => { activeSettled = true; }, () => { activeSettled = true; });
    const port = await admitted(ports);
    const id = Number(port.writes[0]!.id);
    session.receive(port.peer, emptyResponse(id + 1_000));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(activeSettled, false);
    session.receive(port.peer, emptyResponse(id));
    const first = await active;
    assert.deepEqual(first.nodes, []);
    let nextSettled = false;
    const next = session.graph();
    void next.then(() => { nextSettled = true; }, () => { nextSettled = true; });
    await admitted(ports, 2);
    const secondId = Number(port.writes[1]!.id);
    session.receive(port.peer, emptyResponse(id));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(nextSettled, false, "a duplicate reply cannot settle the next request");
    session.receive(port.peer, emptyResponse(secondId + 1_000));
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(nextSettled, false);
    session.receive(port.peer, emptyResponse(secondId, false));
    assert.equal(await next, first, "unchanged response reuses resident memory");
    assert.equal(ports.length, 1);
  } finally { await session.close(); }
}
