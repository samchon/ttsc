import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a native shard digest disagreement retires the whole child.
 *
 * A transaction is atomic only if an invalid replacement cannot become the base
 * of the next request. The client must discard that process generation, then
 * accept a complete generation from a fresh child.
 *
 * 1. Make the first fake process publish one shard under a false digest.
 * 2. Assert the call rejects and that child exits.
 * 3. Assert the next call starts a replacement process and succeeds.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession rejects wrong-digest as mismatching shard content, observes the original child dead and successfully obtains an empty graph from a replacement.
 * @evidence contracts/testing.md#independent-expectations The deliberately false literal digest independently contradicts the fixture payload; rejection text, dead PID and two-child count are observable controls.
 * @evidence contracts/testing.md#distinguishing-cases Corrupt digest on the first response contrasts a valid subsequent process, detecting both validation and recovery rather than acceptance-only behavior.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_bad_native_shard_digest_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Real framed transport, digest verification and child retirement must interact; the compiled Go peer emits controlled protocol payloads rather than checker-produced facts.
 * @evidence contracts/e2e.md#shared-execution The shared nativeSession stand-in build serves this and sibling protocol cases. Its first-only fault needs a cold session; later recovery shares the project but not the retired child, with full batching unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique fault marker and PID logs isolate this first corruption from another case's warm state; finally closes the session and explicit polling confirms retirement.
 * @evidence contracts/e2e.md#preserved-coverage Digest rejection, original PID death, recovered empty graph and exactly two child lifetimes remain unchanged.
 */
export const test_ttscgraph_bad_native_shard_digest_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "bad-shard-digest-once",
    });
    try {
      await assert.rejects(
        session.graph(),
        /digest wrong-digest does not match/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(() => !processIsAlive(firstPid), "bad-shard child exit");
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
