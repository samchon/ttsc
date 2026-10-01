import assert from "node:assert/strict";
import { admitted, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies a manifest ordered by UTF-8 bytes is accepted although it is not UTF-16 order.
 *
 * The transaction's two shard keys end in U+E000 and U+10000. UTF-8 byte order
 * (the producer's order) puts U+E000 first, while JavaScript string comparison
 * would put U+10000 first. The session must accept the manifest as ordered.
 *
 * 1. Start a graph request on a recorded line port and load the "unicode" typed
 *    transaction, asserting its manifest keys are U+E000 then U+10000.
 * 2. Deliver it and require the graph to resolve with an empty node list.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of the unicode transaction, whose manifest keys are 0:metadata:U+E000 then 0:metadata:U+10000, must let graph() resolve to a model with no nodes, which requires the shard store to accept that order and the pinned digests and generation.
 * @evidence contracts/testing.md#independent-expectations The two keys, their shard digests and the generation are pinned literals in sessionTransactions, authored from the producer's Go encoding and key order rather than computed by the product's hash or sort helpers; the test asserts the key order literally before delivering.
 * @evidence contracts/testing.md#distinguishing-cases The keys sort differently under UTF-8 and UTF-16 comparison, so an implementation comparing JavaScript strings would reject this manifest as unsorted. Only the accepting direction is covered; a manifest in UTF-16 order is not delivered to show rejection.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState and TtscGraphShardStore in the test process against the recorded line ports of internal/sessionState with a typed envelope passed to receive; TtscGraphProtocol.decode and a native process are not executed.
 */
export async function test_ttscgraph_native_manifest_uses_go_utf8_order(): Promise<void> {
  const fixture = sessionState();
  const { session, ports } = fixture;
  try {
    const active = session.graph();
    const port = await admitted(ports);
    const snapshot = sessionTransaction("unicode");
    assert.deepEqual(snapshot.manifest.map((item) => item.key), ["0:metadata:\ue000", "0:metadata:\u{10000}"]);
    session.receive(port.peer, { id: Number(port.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot });
    assert.deepEqual((await active).nodes, []);
  } finally { session.close(); }
}
