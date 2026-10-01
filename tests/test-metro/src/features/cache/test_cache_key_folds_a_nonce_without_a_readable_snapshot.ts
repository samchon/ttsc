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
 *
 * @evidence contracts/testing.md#behavioral-verification Two fresh source transformers without a prepared snapshot return different 64-character cache keys.
 * @evidence contracts/testing.md#independent-expectations An unknown observation set must withdraw cross-run reuse; inequality and digest width are literal contract expectations.
 * @evidence contracts/testing.md#distinguishing-cases Unprepared state contrasts the stable prepared-project entry.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_folds_a_nonce_without_a_readable_snapshot =
  async () => {
    await assertCacheKeyFoldsNonceWithoutReadableSnapshot();
  };
