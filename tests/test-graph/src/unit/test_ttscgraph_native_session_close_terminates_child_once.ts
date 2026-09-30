import assert from "node:assert/strict";
import { admitted, assertRetired, pendingCount, sessionState } from "./internal/sessionState";

/**
 * Verifies close settles active and queued requests once.
 *
 * Idempotent terminal state must settle both ownership positions, remove pending entries and forbid a future opener call.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification Double close rejects active and queued requests exactly once, retires the port once, empties pending entries and rejects future graph calls without another opener.
 * @evidence contracts/testing.md#independent-expectations Independent settlement counters, literal active/queued/post-close errors and exact pending/retirement/opener counts establish terminal idempotence. Actual process death remains in the real adapter boundary.
 * @evidence contracts/testing.md#distinguishing-cases Idempotent terminal state must settle both ownership positions, remove pending entries and forbid a future opener call.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_native_session_close_terminates_child_once(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    let activeSettlements = 0;
    let queuedSettlements = 0;
    const active = session.graph().finally(() => { activeSettlements++; });
    const queued = session.graph().finally(() => { queuedSettlements++; });
    const port = await admitted(ports);
    session.close(); session.close();
    await assert.rejects(active, /native session closed/);
    await assert.rejects(queued, /native session is closed/);
    assertRetired(port);
    assert.equal(activeSettlements, 1);
    assert.equal(queuedSettlements, 1);
    assert.equal(pendingCount(session), 0);
    await assert.rejects(session.graph(), /native session is closed/);
    assert.equal(ports.length, 1);
    assert.equal(fixture.closed(), 1);
  } finally { session.close(); }
}
