import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";

/**
 * Verifies active abort retires and resets the resident owner.
 *
 * Queue admission and an outstanding recorded write establish active ownership before abort; an unprintable reason must not prevent cleanup.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification An AbortSignal with an unprintable reason rejects a confirmed pending request, retires its port and returns an empty graph through one replacement.
 * @evidence contracts/testing.md#independent-expectations A recorded request write proves admission before abort; the throwing toString, literal cancellation error and exact port/retirement counts independently distinguish active cleanup from queued cancellation.
 * @evidence contracts/testing.md#distinguishing-cases Queue admission and an outstanding recorded write establish active ownership before abort; an unprintable reason must not prevent cleanup.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_native_request_abort_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const controller = new AbortController();
    const active = session.graph({ signal: controller.signal });
    const port = await admitted(ports);
    controller.abort({ toString(): string { throw new Error("unprintable cancellation reason"); } });
    await assert.rejects(active, /native snapshot request cancelled/);
    assertRetired(port);

    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
