import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies invalid JSON retires state before recovery.
 *
 * Actual source JSON parsing rejects the malformed line before generated schema code is reached; typed inputs cover the later recovered state.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual source JSON parser rejects not-json, state retires its port and a matching typed response on one replacement returns empty nodes.
 * @evidence contracts/testing.md#independent-expectations Literal non-JSON bytes and invalid-JSON error are independent inputs/oracles; direct typed recovery does not claim full generated shape validation.
 * @evidence contracts/testing.md#distinguishing-cases Actual source JSON parsing rejects the malformed line before generated schema code is reached; typed inputs cover the later recovered state.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
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
