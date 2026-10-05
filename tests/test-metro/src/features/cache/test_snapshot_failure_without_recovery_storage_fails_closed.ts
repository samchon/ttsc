import { assertSnapshotFailureWithoutRecoveryStorageFailsClosed } from "../../internal/metro-cache";

/**
 * Verifies snapshot maintenance fails closed when no durable invalidation can
 * be written. A readable stale main is never accepted as a fallback merely
 * because both the primary and recovery locations reject writes.
 *
 * 1. Prepare a reusable run and replace the cache directory holding both the
 *    snapshot and its recovery location with a regular file.
 * 2. Assert the recorder fails and preparation transports a private nonreusable
 *    token.
 * 3. Restore storage and verify old private tokens still nonce while ordinary runs
 *    stabilize.
 *
 * @evidence contracts/testing.md#behavioral-verification With the cache directory holding the snapshot and recovery locations replaced by a regular file, so the main snapshot is unreachable and both stores reject writes, a reusable-run recorder throws an AggregateError with the persist-failure message and prepareSnapshot returns a nonce:<32 hex> token; after access returns, recovery files are gone, computeProjectFingerprint with that token differs between two calls, and ordinary getCacheKey values are equal.
 * @evidence contracts/testing.md#independent-expectations The fail-closed contract is checked through authored literals: the exact error name and message, the nonce token regular expression, empty recovery listing, inequality for the old token and equality for ordinary runs.
 * @evidence contracts/testing.md#distinguishing-cases Both storage locations unusable (throw and nonce token) contrast restored access (token still nonces, ordinary keys stable). The obstruction is a regular file, which fails for root and on every OS, so the body never skips; one obstruction removes both stores, so the case where only one of them fails is owned by the write-failure and compaction-failure entries.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot, createSnapshotRecorder, computeProjectFingerprint and getCacheKey in-process, using only a regular file placed over the cache directory to make it unusable; no native compile, consumer install or Metro host.
 */
export const test_snapshot_failure_without_recovery_storage_fails_closed =
  async () => {
    await assertSnapshotFailureWithoutRecoveryStorageFailsClosed();
  };
