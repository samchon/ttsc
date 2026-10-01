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
 * @evidence contracts/testing.md#behavioral-verification A valid worker document declaring volatile output causes two fresh cache keys to differ.
 * @evidence contracts/testing.md#independent-expectations Non-file inputs cannot be fingerprinted and must withdraw cross-run reuse; the independent oracle is inequality for the same project bytes.
 * @evidence contracts/testing.md#distinguishing-cases A schema4 volatile worker contrasts an ordinary stable snapshot and the clearing-worker case.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_folds_a_nonce_while_the_snapshot_records_volatile =
  async () => {
    await assertCacheKeyFoldsNonceWhileSnapshotVolatile();
  };
