import { assertIndependentGraphLeafCompileSnapshotAbaRaceCannotAuthorizeStaleOutput } from "../../internal/transform-project-cache";

/**
 * Verifies transformTtsc rejects an ABA mutation in an independent graph leaf.
 *
 * A leaf with no incoming or outgoing source edge is represented only by its
 * empty adjacency key. If JavaScript decoding drops that key, the compiler's
 * transient input proof is ignored and stale output can enter a persistent
 * generation even though the file returns to its original bytes.
 *
 * 1. Compile two independent roots while the lazy root changes A-to-B-to-A.
 * 2. Let the shared generation retry, then request the lazy root from cache.
 * 3. Assert the torn attempt is discarded and B's output is never served.
 */
export const test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output =
  async () => {
    await assertIndependentGraphLeafCompileSnapshotAbaRaceCannotAuthorizeStaleOutput();
  };
