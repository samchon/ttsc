import {
  createNativeSessionFixture,
  pendingCount,
  readPids,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a response carrying an unrecognised id neither settles the live
 * request nor disturbs the session.
 *
 * Replies are paired to requests by id, so a frame naming an id nobody is
 * waiting on is not authority to resolve the request in flight — resolving on
 * it would hand the caller another request's graph. It must also be harmless:
 * the matching frame follows immediately, and the session has to answer from it
 * and stay usable.
 *
 * The unknown frame deliberately carries a graph rather than an unchanged
 * reply, so a client that settled on it would answer with a graph the request
 * never asked for — and both calls detect that, instead of only the first.
 *
 * 1. Make the fake emit an unknown response id, carrying its own graph, before
 *    each matching response.
 * 2. Call the session twice.
 * 3. Assert both answers are the resident one, the child never restarted, and no
 *    pending entry leaked.
 */
export const test_ttscgraph_unknown_native_response_id_does_not_settle_the_live_request =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "unknown-then-respond",
    });
    try {
      const first = await session.graph();
      assert.deepEqual(first.nodes, []);
      const second = await session.graph();
      assert.equal(second, first, "unchanged response reuses resident memory");
      assert.equal(readPids(root).length, 1, "the child never restarted");
      assert.equal(pendingCount(session), 0, "no pending request leaked");
    } finally {
      session.close();
    }
  };
