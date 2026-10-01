import assert from "node:assert/strict";
import { admitted, assertRetired, emptyResponse, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies a transaction with a wrong shard digest retires the peer before recovery.
 *
 * A shard whose declared digest does not match its content must be rejected
 * rather than committed as a partially accepted generation, and the next request
 * must be served from a fresh peer.
 *
 * 1. Start a graph request on a recorded line port, then deliver a typed initial
 *    transaction whose first upsert digest is "wrong-digest".
 * 2. Require the rejection to name that digest and the port to be retired
 *    (reader detached, then stdio joined).
 * 3. Request again, answer the second port with an empty full-dump response, and
 *    require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of a transaction whose upserts[0].digest is "wrong-digest" must reject graph() with "digest wrong-digest does not match", retire the first port as close(false) then close(true) with live false, and a second graph() must open a second port and resolve to a model with no nodes.
 * @evidence contracts/testing.md#independent-expectations The wrong digest string, the expected error pattern, the retirement sequence [false, true], the empty node list and the port count of two are literals; the remaining shard digests and the generation in the fixture are pinned literals in sessionTransactions and the recovery reply is an empty dump built by emptyResponse.
 * @evidence contracts/testing.md#distinguishing-cases Only the upsert digest is corrupted while the manifest and generation are pinned valid, so the per-shard content check is the one that fires; the accepted empty-dump reply on the second port contrasts the rejected transaction. A wrong generation and a stale base are covered by other tests.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState and TtscGraphShardStore directly in the test process against the recorded line ports of internal/sessionState. The test calls receive with typed envelopes, so TtscGraphProtocol.decode, generated schema validation and a native process are not executed.
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
    await assert.rejects(active, /digest wrong-digest does not match/);
    assertRetired(port);

    const recovered = session.graph();
    const next = await admitted(ports);
    session.receive(next.peer, emptyResponse(Number(next.writes[0]!.id)));
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally { session.close(); }
}
