import { assertCacheKeyChangesWhenTheTsconfigChanges } from "../../internal/metro-cache";

/**
 * Verifies editing the tsconfig between runs changes the cache key.
 *
 * See {@link assertCacheKeyChangesWhenTheTsconfigChanges}: the project walk no
 * longer hashes files that cannot enter the program, so this pins the outcome
 * that matters, that a compiler-option change still re-keys the run
 * (samchon/ttsc#1307).
 *
 * 1. Create a plugin-less project, prepare the snapshot, compute the key.
 * 2. Change a compiler option; compute the key in a fresh transformer module.
 * 3. Assert the keys differ.
 */
export const test_cache_key_changes_when_the_tsconfig_changes = async () => {
  await assertCacheKeyChangesWhenTheTsconfigChanges();
};
