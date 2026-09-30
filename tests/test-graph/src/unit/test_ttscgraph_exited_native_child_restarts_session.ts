import assert from "node:assert/strict";
import { admitted, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies an exit event retires correlation before recovery.
 *
 * An exit event must settle the pending request once and permit the next request to open a new transport owner.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification An explicit exit-17 event rejects the active request, detaches its reader without redundant termination and returns empty nodes on one replacement.
 * @evidence contracts/testing.md#independent-expectations The typed exit event is the failure stimulus; literal error alternatives, [false] retirement and two opener calls define the required source-state consequence. Actual kernel exit is checked by the real adapter boundary.
 * @evidence contracts/testing.md#distinguishing-cases An exit event must settle the pending request once and permit the next request to open a new transport owner.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_exited_native_child_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    port.live = false;
    port.events.exit(17, null);
    await assert.rejects(active, /native session exited|could not request native snapshot/);
    assert.deepEqual(port.retirement, [false]);

    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
