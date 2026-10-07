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
 * @evidence contracts/testing.md#behavioral-verification Without ever calling prepareSnapshot, two getCacheKey calls from fresh transformer modules return different keys, and the first is 64 characters long.
 * @evidence contracts/testing.md#independent-expectations Inequality and the 64-character width of the first key are authored literals from the nonce contract; only the first key's width is asserted, not the second's.
 * @evidence contracts/testing.md#distinguishing-cases Only the unprepared case is run here; the prepared-snapshot stable equality is a separate entry.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the transformer module's getCacheKey in-process on a temp project with a fake upstream and no snapshot; no native compile, consumer install or Metro host.
 */
export const test_cache_key_folds_a_nonce_without_a_readable_snapshot =
  async () => {
    await assertCacheKeyFoldsNonceWithoutReadableSnapshot();
  };
