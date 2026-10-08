import { assertCacheKeyFoldsNonceWhileSnapshotVolatile } from "../../internal/metro-cache";

/**
 * Verifies a volatile marker in the snapshot degrades the key to a per-run
 * nonce.
 *
 * A plugin-declared volatile output depends on non-file inputs (environment,
 * time, network) that no file fingerprint can represent, and Metro exposes no
 * per-file uncacheable control; disabling cross-run reuse for the whole project
 * is the only sound encoding Metro's contract admits.
 *
 * 1. Prepare the snapshot, then drop a worker snapshot with `volatile: true`.
 * 2. Compute `getCacheKey` in two fresh transformer modules.
 * 3. Assert the keys differ.
 *
 * @evidence contracts/testing.md#behavioral-verification After prepareSnapshot, a hand-written worker document with version 5 and volatile true makes two getCacheKey calls from fresh transformer modules return different keys.
 * @evidence contracts/testing.md#independent-expectations The authored document is a literal version-5 volatile worker file, and the expectation is inequality over unchanged sources, following the contract that non-file inputs withdraw reuse rather than any implementation output.
 * @evidence contracts/testing.md#distinguishing-cases Only the volatile case is run here. The prepared stable snapshot and the volatile-clearing transition are covered by other entries, not by this body.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot and getCacheKey in-process over a temp project with a fake upstream, writing the worker document with fs; no native compile, consumer install or Metro host.
 */
export const test_cache_key_folds_a_nonce_while_the_snapshot_records_volatile =
  async () => {
    await assertCacheKeyFoldsNonceWhileSnapshotVolatile();
  };
