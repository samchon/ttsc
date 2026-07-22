import { assertSnapshotFailureWithoutRecoveryStorageFailsClosed } from "../../internal/metro-cache";

/**
 * Verifies snapshot maintenance fails closed when no durable invalidation can
 * be written. A readable stale main is never accepted as a fallback merely
 * because both the primary and recovery locations reject writes.
 */
export const test_snapshot_failure_without_recovery_storage_fails_closed =
  async () => {
    await assertSnapshotFailureWithoutRecoveryStorageFailsClosed();
  };
