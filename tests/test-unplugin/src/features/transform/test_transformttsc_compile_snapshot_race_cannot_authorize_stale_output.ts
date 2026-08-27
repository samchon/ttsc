import { assertCompileSnapshotRaceCannotAuthorizeStaleOutput } from "../../internal/transform-project-cache";

/**
 * Verifies transformTtsc: rejects a torn compile/snapshot generation.
 *
 * A project input can change after the native transform has read it but before
 * the JavaScript host captures persistent-cache hashes. Blessing the later hash
 * beside the earlier output would make stale code authoritative indefinitely.
 *
 * 1. Change an unserved sibling after the first native transform returns but
 *    before the generation snapshot walk reads it.
 * 2. Let the shared generation retry, then request that sibling from the cache.
 * 3. Assert exactly two transforms run and only the stable retry is reused.
 */
export const test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output =
  async () => {
    await assertCompileSnapshotRaceCannotAuthorizeStaleOutput();
  };
