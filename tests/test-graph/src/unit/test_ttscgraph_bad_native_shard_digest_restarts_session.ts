import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies a false shard digest retires state before recovery.
 *
 * An explicit wrong digest must fail content validation, not become a reusable partially accepted generation.
 *
 * 1. Admit the original request state through the authored state owner.
 * 2. Supply explicit typed envelopes or transport events and check the original rejection, settlement or model assertions.
 * 3. Check retirement, recovery or reuse and close the owned state in finally.
 *
 * @evidence contracts/testing.md#behavioral-verification State refresh rejects the wrong-digest upsert, retires exactly one port and returns empty nodes on exactly one replacement.
 * @evidence contracts/testing.md#independent-expectations The explicit wrong-digest value violates the pinned content witness; expected error, empty nodes and opener/retirement counts do not come from product serialization.
 * @evidence contracts/testing.md#distinguishing-cases An explicit wrong digest must fail content validation, not become a reusable partially accepted generation.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit export imports authored state and decoder source. Declared line-port recordings generate no reply; this executes in the source-unit Node process without a native executable. Actual kernel retirement and generated schema integration remain in the minimal E2E boundary.
 */
export async function test_ttscgraph_bad_native_shard_digest_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const snapshot = sessionTransaction();
    snapshot.upserts[0]!.digest = "wrong-digest";
    session.receive(port.peer, { id: Number(port.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot });
    await assert.rejects(active, /native shard .* digest wrong-digest/);
    assertRetired(port);

    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
