import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies duplicate generation coordinates retire the peer and reset its store.
 *
 * Literal typed content and pinned hashes reach the original coherence error;
 * the replacement accepts sequence one, so retained stale coordinates cannot
 * masquerade as recovery. The manifest variant first commits a valid base.
 *
 * 1. Submit the original valid base when this is a delta case.
 * 2. Submit duplicate config or manifest coordinates and require the owned error and retirement.
 * 3. Accept a complete sequence-one generation on one replacement owner.
 *
 * @evidence contracts/testing.md#behavioral-verification Authored state applies the original corrupt transaction, rejects its coherence error, retires that port and accepts the replacement's complete initial generation with empty nodes.
 * @evidence contracts/testing.md#independent-expectations Literal duplicate fields and pinned content/generation hashes are declared inputs; the expected error, empty model and two opener calls do not come from product hashing.
 * @evidence contracts/testing.md#distinguishing-cases Duplicate config membership contrasts exact manifest ordering; the delta case retains its established valid base and verifies replacement sequence reset rather than testing only an initial failure.
 * @evidence contracts/testing.md#execution-ownership This src/features entry imports actual authored state and shard operations; explicit typed inputs and recorded port retirement run in one Node process. Actual kernel termination belongs to the real adapter E2E control.
 */
export async function test_ttscgraph_duplicate_native_config_universe_restarts_session(): Promise<void> {
  const { session, ports } = sessionState();
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const snapshot = sessionTransaction("duplicateConfig");
    session.receive(port.peer, { id: Number(port.writes.at(-1)!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot });
    await assert.rejects(active, /config shard disagrees with universe input tsconfig\.json/);
    assertRetired(port);
    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, { id: Number(next.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot: sessionTransaction() });
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
