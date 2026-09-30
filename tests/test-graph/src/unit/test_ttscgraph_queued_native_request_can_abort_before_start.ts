import assert from "node:assert/strict";
import { admitted, sessionState } from "./internal/sessionState";

/**
 * Verifies queued abort preserves the active peer.
 *
 * The head remains outstanding while queued cancellation must settle immediately, independently of that head or any transport response.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification Queued abort rejects under the original one-second bound while the head remains live with exactly one write/opener; close then rejects that head.
 * @evidence contracts/testing.md#independent-expectations An outstanding recorded head, elapsed bound, live port and exact write/opener counts distinguish immediate queue cancellation from waiting behind or retiring the head.
 * @evidence contracts/testing.md#distinguishing-cases The head remains outstanding while queued cancellation must settle immediately, independently of that head or any transport response.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_queued_native_request_can_abort_before_start(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const head = session.graph();
    const port = await admitted(ports);
    const controller = new AbortController();
    const started = Date.now();
    const queued = session.graph({ signal: controller.signal });
    controller.abort();
    await assert.rejects(queued, /native snapshot request cancelled/);
    assert.ok(Date.now() - started < 1_000, "queued cancellation is immediate");
    assert.equal(port.live, true);
    assert.equal(ports.length, 1);
    assert.equal(port.writes.length, 1);
    session.close();
    await assert.rejects(head, /native session closed/);
  } finally { session.close(); }
}
