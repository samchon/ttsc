import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies a delta with a duplicated manifest key retires the peer and resets the shard store.
 *
 * The first graph is committed from a valid initial transaction. A second,
 * incremental transaction then lists the same shard key twice in its manifest.
 * The session must reject it, retire the peer, and accept a sequence-one initial
 * transaction on the next peer, which is only possible if the committed
 * coordinates were discarded with the old peer.
 *
 * 1. Commit a valid initial transaction and require an empty node list.
 * 2. Deliver the "duplicateManifest" delta (sequence 2 on the committed base) and
 *    require the rejection "manifest must be strictly key-sorted" and the port to
 *    be retired (reader detached, then stdio joined).
 * 3. Request again, answer the second port with a sequence-one initial
 *    transaction, and require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification After a committed initial graph, TtscGraphSessionState.receive of the duplicateManifest delta must reject graph() with "manifest must be strictly key-sorted", retire the port as close(false) then close(true), and a second graph() must accept a sequence-one initial transaction on a second port and resolve to a model with no nodes.
 * @evidence contracts/testing.md#independent-expectations The duplicated manifest entries, base sequence 1 and the base generation taken from the baseline fixture, the pinned digest literals in sessionTransactions, the expected error pattern, the retirement sequence [false, true], the empty node list and the port count of two are authored literals. The duplicateManifest generation literal is not reached because the sort check fails first.
 * @evidence contracts/testing.md#distinguishing-cases The delta is coordinate-valid and its upsert digests match, so only manifest ordering fails. Accepting a sequence-one initial transaction after a committed sequence-one generation distinguishes a reset shard store from retained stale coordinates. The duplicate-config case is covered by a separate test.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState and TtscGraphShardStore directly in the test process against the recorded line ports of internal/sessionState. The test calls receive with typed envelopes, so TtscGraphProtocol.decode, generated schema validation and a native process are not executed.
 */
export async function test_ttscgraph_duplicate_native_shard_manifest_restarts_session(): Promise<void> {
  const { session, ports } = sessionState();
  try {
    const initial = session.graph();
    const first = await admitted(ports);
    const baseline = sessionTransaction();
    session.receive(first.peer, { id: Number(first.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot: baseline });
    assert.deepEqual((await initial).nodes, []);
    const active = session.graph();
    const port = await admitted(ports, 2);
    const snapshot = sessionTransaction("duplicateManifest");
    snapshot.sequence = 2;
    snapshot.baseSequence = 1;
    snapshot.baseGeneration = baseline.generation;
    session.receive(port.peer, { id: Number(port.writes.at(-1)!.id), protocolVersion: 1, mode: "incremental", changed: true, capabilities: [], snapshot });
    await assert.rejects(active, /manifest must be strictly key-sorted/);
    assertRetired(port);
    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, { id: Number(next.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot: sessionTransaction() });
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
