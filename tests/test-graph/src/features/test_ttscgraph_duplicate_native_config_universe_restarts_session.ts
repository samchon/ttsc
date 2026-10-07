import assert from "node:assert/strict";

import {
  admitted,
  assertRetired,
  emptyResponse,
  sessionState,
} from "./internal/sessionState";
import { sessionTransaction } from "./internal/sessionTransactions";

/**
 * Verifies a build universe listing one config twice retires the peer before
 * recovery.
 *
 * The transaction's universe names tsconfig.json twice while its shards cover
 * that config once plus a second config (hidden.json) the universe does not
 * list. The session must reject it, retire the peer and accept a fresh
 * sequence-one generation on the next peer.
 *
 * 1. Start a graph request on a recorded line port and deliver the
 *    "duplicateConfig" typed transaction.
 * 2. Require the rejection "config shard disagrees with universe input
 *    tsconfig.json" and the port to be retired (reader detached, then stdio
 *    joined).
 * 3. Request again, answer the second port with a valid initial transaction, and
 *    require an empty node list and exactly two opened ports.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSessionState.receive of the duplicateConfig transaction must reject graph() with "config shard disagrees with universe input tsconfig.json", retire the first port as close(false) then close(true), and a second graph() must accept a valid initial transaction on a second port and resolve to a model with no nodes.
 * @evidence contracts/testing.md#independent-expectations The duplicated universe entries, the extra hidden.json config shard, the pinned digest and generation literals in sessionTransactions, the expected error pattern, the retirement sequence [false, true], the empty node list and the port count of two are authored literals, not computed by the product hasher.
 * @evidence contracts/testing.md#distinguishing-cases The transaction passes the digest, manifest and generation checks and fails only the universe-to-config-shard agreement (the second universe entry finds its config already consumed); the valid initial transaction accepted afterwards contrasts it. Because the rejected transaction is never committed, this test does not show a shard store being reset; the manifest test does.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSessionState and TtscGraphShardStore directly in the test process against the recorded line ports of internal/sessionState. The test calls receive with typed envelopes, so TtscGraphProtocol.decode, generated schema validation and a native process are not executed.
 */
export async function test_ttscgraph_duplicate_native_config_universe_restarts_session(): Promise<void> {
  const { session, ports } = sessionState();
  try {
    const active = session.graph();
    void active.catch(() => undefined);
    const port = await admitted(ports);
    const snapshot = sessionTransaction("duplicateConfig");
    session.receive(port.peer, {
      id: Number(port.writes.at(-1)!.id),
      protocolVersion: 1,
      mode: "initial",
      changed: true,
      capabilities: [],
      snapshot,
    });
    await assert.rejects(
      active,
      /config shard disagrees with universe input tsconfig\.json/,
    );
    assertRetired(port);
    const recovered = session.graph();
    void recovered.catch(() => undefined);
    const next = await admitted(ports);
    session.receive(next.peer, {
      id: Number(next.writes[0]!.id),
      protocolVersion: 1,
      mode: "initial",
      changed: true,
      capabilities: [],
      snapshot: sessionTransaction(),
    });
    assert.deepEqual((await recovered).nodes, []);
    assert.equal(ports.length, 2);
  } finally {
    await session.close();
  }
}
