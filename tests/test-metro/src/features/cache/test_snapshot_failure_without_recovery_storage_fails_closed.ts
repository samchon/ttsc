import { assertSnapshotFailureWithoutRecoveryStorageFailsClosed } from "../../internal/metro-cache";

/**
 * Verifies snapshot maintenance fails closed when no durable invalidation can
 * be written. A readable stale main is never accepted as a fallback merely
 * because both the primary and recovery locations reject writes.
 *
 * 1. Prepare a reusable run and deny primary plus sibling recovery writes.
 * 2. Assert the recorder fails and preparation transports a private nonreusable token.
 * 3. Restore storage and verify old private tokens still nonce while ordinary runs stabilize.
 *
 * @evidence contracts/testing.md#behavioral-verification With the main snapshot unreadable and both the snapshot and cache directories denied for creation, a reusable-run recorder throws an AggregateError with the persist-failure message and prepareSnapshot returns a nonce:<32 hex> token; after access returns, recovery files are gone, computeProjectFingerprint with that token differs between two calls, and ordinary getCacheKey values are equal.
 * @evidence contracts/testing.md#independent-expectations The fail-closed contract is checked through authored literals: the exact error name and message, the nonce token regular expression, empty recovery listing, inequality for the old token and equality for ordinary runs.
 * @evidence contracts/testing.md#distinguishing-cases Both storage locations denied (throw and nonce token) contrast restored access (token still nonces, ordinary keys stable). Denial uses mode bits on POSIX and an Everyone deny entry via icacls on Windows; when the process is root the body logs a SKIPPED notice and asserts nothing.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls prepareSnapshot, createSnapshotRecorder, computeProjectFingerprint and getCacheKey in-process, using chmod or icacls only to deny access; no native compile, consumer install or Metro host.
 */
export const test_snapshot_failure_without_recovery_storage_fails_closed =
  async () => {
    await assertSnapshotFailureWithoutRecoveryStorageFailsClosed();
  };
