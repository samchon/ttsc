import assert from "node:assert/strict";
import { admitted, assertRetired, sessionState } from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies a manifest ordered by UTF-8 bytes is accepted and the same manifest in UTF-16 order is rejected.
 *
 * The transaction's two shard keys end in U+E000 and U+10000. UTF-8 byte order
 * (the producer's order) puts U+E000 first, while JavaScript string comparison
 * would put U+10000 first. The session must accept the manifest as ordered, and
 * must refuse the reversed listing as unsorted and retire the peer.
 *
 * 1. Start a graph request on a recorded line port and load the "unicode" typed
 *    transaction, asserting its manifest keys are U+E000 then U+10000.
 * 2. Deliver it and require the graph to resolve with an empty node list.
 * 3. On a fresh session deliver the same transaction with the manifest reversed
 *    into UTF-16 order and require the "manifest must be strictly key-sorted"
 *    rejection and the port to be retired.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of the unicode transaction, whose manifest keys are 0:metadata:U+E000 then 0:metadata:U+10000, must let graph() resolve to a model with no nodes, which requires the shard store to accept that order and the pinned digests and generation; the same transaction with the two manifest entries swapped must reject graph() with "manifest must be strictly key-sorted" and retire the port as close(false) then close(true).
 * @evidence contracts/testing.md#independent-expectations The two keys, their shard digests and the generation are pinned literals in sessionTransactions, authored from the producer's Go encoding and key order rather than computed by the product's hash or sort helpers; the test asserts the key order literally before delivering, and the reversed order is the literal swap of those two entries.
 * @evidence contracts/testing.md#distinguishing-cases The keys sort differently under UTF-8 and UTF-16 comparison, so an implementation comparing JavaScript strings would reject the accepted manifest and accept the reversed one; the pair of directions distinguishes the byte order from the code-unit order. Only the two keys of one transaction are covered, not a longer manifest.
 * @evidence contracts/testing.md#execution-ownership This exported src/features entry runs the owning session state with recorded line ports in the test process, without a native child, installation or product serializer.
 */
export async function test_ttscgraph_native_manifest_uses_go_utf8_order(): Promise<void> {
  {
    const { session, ports } = sessionState();
    try {
      const active = session.graph();
      void active.catch(() => undefined);
      const port = await admitted(ports);
      const snapshot = sessionTransaction("unicode");
      assert.deepEqual(snapshot.manifest.map((item) => item.key), ["0:metadata:", "0:metadata:\u{10000}"]);
      session.receive(port.peer, { id: Number(port.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot });
      assert.deepEqual((await active).nodes, []);
    } finally { await session.close(); }
  }
  {
    const { session, ports } = sessionState();
    try {
      const active = session.graph();
      void active.catch(() => undefined);
      const port = await admitted(ports);
      const snapshot = sessionTransaction("unicode");
      snapshot.manifest.reverse();
      assert.deepEqual(snapshot.manifest.map((item) => item.key), ["0:metadata:\u{10000}", "0:metadata:"]);
      session.receive(port.peer, { id: Number(port.writes[0]!.id), protocolVersion: 1, mode: "initial", changed: true, capabilities: [], snapshot });
      await assert.rejects(active, /manifest must be strictly key-sorted/);
      assertRetired(port);
    } finally { await session.close(); }
  }
}
