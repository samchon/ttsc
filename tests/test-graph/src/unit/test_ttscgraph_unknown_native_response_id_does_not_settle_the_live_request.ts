import assert from "node:assert/strict";
import { admitted, emptyResponse, pendingCount, sessionState } from "./internal/sessionState";

/**
 * Verifies unknown ids cannot settle an active request.
 *
 * Each unsolicited graph-bearing input precedes the matching response; unchanged reuse must preserve object identity and one peer without leaking pending entries.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification Unknown graph-bearing ids leave the pending request untouched; matching inputs then produce empty nodes and unchanged model identity with one port and no leaked pending entry.
 * @evidence contracts/testing.md#independent-expectations Explicit id+1000 inputs precede both matching replies; pending-one/zero, object identity and one-opener literals independently distinguish correlation from accepting whichever frame arrives first.
 * @evidence contracts/testing.md#distinguishing-cases Each unsolicited graph-bearing input precedes the matching response; unchanged reuse must preserve object identity and one peer without leaking pending entries.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
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
