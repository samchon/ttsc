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
 */
export const test_cache_key_folds_a_nonce_while_the_snapshot_records_volatile =
  async () => {
    await assertCacheKeyFoldsNonceWhileSnapshotVolatile();
  };
