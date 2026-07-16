import { assertCacheKeyChangesWhenSnapshotRecreated } from "../../internal/metro-cache";

/**
 * Verifies a deleted-and-recreated snapshot mints a new key epoch.
 *
 * The recorded out-of-walk input set of a lost snapshot is unknown, so its keys
 * must never alias: a wiped `node_modules` combined with a retained Metro cache
 * in the OS temp directory would otherwise replay outputs whose external inputs
 * changed while no snapshot was watching.
 *
 * 1. Prepare the snapshot and compute the key.
 * 2. Delete the snapshot directory and prepare again (fresh epoch id).
 * 3. Assert the new run's key differs.
 */
export const test_cache_key_changes_when_the_snapshot_is_recreated =
  async () => {
    await assertCacheKeyChangesWhenSnapshotRecreated();
  };
