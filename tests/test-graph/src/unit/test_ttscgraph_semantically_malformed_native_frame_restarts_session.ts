import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies contradictory typed state retires its peer.
 *
 * A shape-valid unchanged frame carrying a dump violates generation semantics independently of schema decoding.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification A typed initial dump claiming changed:false reaches state semantic validation, rejects its contradiction, retires the port and recovers on one replacement.
 * @evidence contracts/testing.md#independent-expectations The authored dump/changed:false contradiction and exact semantic diagnostic do not depend on parser behavior; empty recovered nodes and two opener calls preserve recovery.
 * @evidence contracts/testing.md#distinguishing-cases A shape-valid unchanged frame carrying a dump violates generation semantics independently of schema decoding.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_semantically_malformed_native_frame_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const frame = emptyResponse(Number(port.writes[0]!.id));
    frame.changed = false;
    session.receive(port.peer, frame);
    await assert.rejects(active, /unchanged response carried changed mode or snapshot state/);
    assertRetired(port);

    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
