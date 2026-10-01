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
 * @evidence contracts/testing.md#behavioral-verification Denied primary and sibling recovery storage makes the recorder throw AggregateError and preparation return a nonreusable token that still nonces after permissions recover.
 * @evidence contracts/testing.md#independent-expectations The fail-closed transport contract requires the authored diagnostic, nonce token grammar, durable cleanup and later ordinary stable reuse.
 * @evidence contracts/testing.md#distinguishing-cases Both storage locations denied contrasts recovered access; the permission scenario requires a non-root POSIX host and is not exercised on Windows.
 * @evidence contracts/testing.md#execution-ownership This named src/features/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_snapshot_failure_without_recovery_storage_fails_closed =
  async () => {
    await assertSnapshotFailureWithoutRecoveryStorageFailsClosed();
  };
