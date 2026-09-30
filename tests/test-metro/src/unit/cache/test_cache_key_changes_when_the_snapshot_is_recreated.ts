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
 *
 * @evidence contracts/testing.md#behavioral-verification Removing and recreating only the prepared snapshot directory produces a different project key.
 * @evidence contracts/testing.md#independent-expectations A lost out-of-walk observation set cannot certify reuse of the old epoch; inequality independently expresses that safety contract.
 * @evidence contracts/testing.md#distinguishing-cases A recreated epoch contrasts a stable prepared snapshot with unchanged source.
 * @evidence contracts/testing.md#execution-ownership This named src/unit/cache entry runs authored Metro fingerprint and transformer operations through the serial source-unit loader. Real fixture files and upstream input modules exercise resolution; no consumer installation, native compilation or product host is started.
 */
export const test_cache_key_changes_when_the_snapshot_is_recreated =
  async () => {
    await assertCacheKeyChangesWhenSnapshotRecreated();
  };
