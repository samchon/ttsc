import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies a transaction with a wrong generation hash retires the peer before recovery.
 *
 * The shard digests and manifest in the transaction are valid, so only the
 * generation hash is wrong. The session must reject the request, retire the peer
 * that sent it, and serve the next request from a fresh peer.
 *
 * 1. Start a graph request on a recorded line port, then deliver a typed initial
 *    transaction whose generation is "wrong-generation".
 * 2. Require the rejection to name that generation and the port to be retired
 *    (reader detached, then stdio joined).
 * 3. Request again, answer the second port with an empty full-dump response, and
 *    require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of a transaction carrying generation "wrong-generation" must reject graph() with "native generation wrong-generation", retire the first port as close(false) then close(true) with live false, and a second graph() must open a second port and resolve to a model with no nodes.
 * @evidence contracts/testing.md#independent-expectations The wrong generation string, the pinned literal shard digests in sessionTransactions, the expected error text, the retirement sequence [false, true], the empty node list and the port count of two are literals; the recovery reply is an empty dump built by emptyResponse, not produced by the product's serializer or hasher.
 * @evidence contracts/testing.md#distinguishing-cases Only the generation field is corrupted; the shard digest and manifest agree, so the generation check is the one that fires. The accepted empty-dump reply on the second port contrasts the rejected transaction. A wrong shard digest and a stale base are covered by other tests, and the replacement reply is a full dump rather than a snapshot, so a reset shard store is not observed here.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState and TtscGraphShardStore directly in the test process against the recorded line ports of internal/sessionState. The test calls receive with typed envelopes, so TtscGraphProtocol.decode, generated schema validation and a native process are not executed.
 */
export async function test_ttscgraph_bad_native_generation_restarts_session(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const snapshot = sessionTransaction();
    snapshot.generation = "wrong-generation";
    session.receive(port.peer, { id: Number(port.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot });
    await assert.rejects(active, /native generation wrong-generation/);
    assertRetired(port);

    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
