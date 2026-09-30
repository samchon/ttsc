import {
  createNativeSessionFixture,
  processIsAlive,
  readPids,
  waitFor,
} from "../internal/nativeSession";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies a duplicate manifest key cannot hide another committed shard.
 *
 * Locks the restart boundary after an already committed native generation. A
 * missing store reset would make the replacement child's sequence-one
 * transaction look stale even though it is the only trustworthy new base.
 *
 * 1. Commit one valid shard generation, then hide a second upsert behind a
 *    duplicate manifest key in the next delta.
 * 2. Reject the non-strict manifest and wait for the first child to exit.
 * 3. Start a clean child and accept its complete sequence-one shard generation.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSession first accepts a valid snapshot, rejects a subsequent duplicate/unsorted shard manifest, retires that child and accepts a fresh initial snapshot from its replacement.
 * @evidence contracts/testing.md#independent-expectations Literal duplicate manifest entries violate strict ordering; the prior valid graph is an independent control proving the failure occurs during a delta after established state.
 * @evidence contracts/testing.md#distinguishing-cases Valid sequence-one, invalid sequence-two and valid replacement contrast retained store state with reset state; a first-frame-only check would lose this distinction.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_duplicate_native_shard_manifest_restarts_session loads the built TtscGraphSession and spawns the shared compiled Go protocol stand-in; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual delta/base-generation transport, manifest validation and store reset on child retirement must interact; the Go peer supplies controlled frames, not compiler semantics.
 * @evidence contracts/e2e.md#shared-execution Sibling cases share the memoized Go peer artifact. Three requests reuse one fixture; two child lifetimes are required by the invalid-delta recovery, and population batching remains unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique first marker/PID log preserve valid-then-invalid order and replacement sequence reset; finally closes the session, and explicit polling checks old child death.
 * @evidence contracts/e2e.md#preserved-coverage Original first valid graph, strict-order rejection, old PID death, replacement graph and exactly two recorded children are retained.
 */
export const test_ttscgraph_duplicate_native_shard_manifest_restarts_session =
  async () => {
    const { root, session } = createNativeSessionFixture({
      mode: "duplicate-shard-manifest-once",
    });
    try {
      assert.deepEqual((await session.graph()).nodes, []);
      await assert.rejects(
        session.graph(),
        /manifest must be strictly key-sorted/,
      );
      const firstPid = readPids(root)[0]!;
      await waitFor(
        () => !processIsAlive(firstPid),
        "duplicate-manifest child exit",
      );
      const graph = await session.graph();
      assert.deepEqual(graph.nodes, []);
      assert.equal(readPids(root).length, 2);
    } finally {
      session.close();
    }
  };
