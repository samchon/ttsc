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
 * @evidence contracts/testing.md#behavioral-verification After preparing a snapshot and taking a key, deleting the whole snapshot directory and preparing again yields a different getCacheKey for byte-identical project sources.
 * @evidence contracts/testing.md#independent-expectations The safety contract that a lost snapshot must not alias an older epoch is expressed as literal inequality of two keys over unchanged sources; it does not compute epoch ids itself.
 * @evidence contracts/testing.md#distinguishing-cases Sources and options are held constant, so the recreated snapshot epoch is the only varying input; there is no equal-key control inside this body (see the stable-run test).
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls fingerprint.prepareSnapshot twice and getCacheKey from fresh transformer modules in-process, deleting the snapshot directory with fs.rmSync; no native compile, consumer install or Metro host.
 */
export const test_cache_key_changes_when_the_snapshot_is_recreated =
  async () => {
    await assertCacheKeyChangesWhenSnapshotRecreated();
  };
