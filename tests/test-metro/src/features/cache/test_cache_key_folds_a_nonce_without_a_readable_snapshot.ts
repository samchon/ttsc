import { assertCacheKeyFoldsNonceWithoutReadableSnapshot } from "../../internal/metro-cache";

/**
 * Verifies the sound degradation without a readable snapshot: every run folds a
 * fresh nonce, so no run ever reuses another run's cache entries.
 *
 * Without the snapshot the out-of-walk input set is unknown, and a stable
 * fallback marker would let a stale-input entry from an earlier snapshot-less
 * run be served forever. Cache-less is the sound trade; the documented setup
 * path (`withTtsc`) creates the snapshot so real projects never stay in this
 * mode.
 *
 * 1. Create a project but never prepare a snapshot.
 * 2. Compute `getCacheKey` in two fresh transformer modules.
 * 3. Assert the keys differ.
 */
export const test_cache_key_folds_a_nonce_without_a_readable_snapshot =
  async () => {
    await assertCacheKeyFoldsNonceWithoutReadableSnapshot();
  };
