import { assertCacheKeyChangesWhenTheTsconfigChanges } from "../../../internal/metro/internal/metro-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification A real native transform records its tsconfig; editing that effective config changes the next Metro key.
 * @evidence contracts/testing.md#independent-expectations The authored config path and compiler-option mutation independently determine an input whose meaning can change compilation.
 * @evidence contracts/testing.md#distinguishing-cases Configuration invalidation contrasts source, external-helper and Go-environment changes; source policy matrices retain separate owners.
 * @evidence contracts/testing.md#execution-ownership This named features export test_cache_key_changes_when_the_tsconfig_changes executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Compiler-derived configuration dependencies must reach the worker snapshot, not merely a synthetic filesystem walk.
 * @evidence contracts/e2e.md#shared-execution One project/native transform establishes the observation and the same prepared snapshot drives the later key comparison. Config edits require a new fingerprint, not another installation or compiler invocation in this case.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only this project tsconfig is edited; worker options are restored and compaction transfers recorded inputs into its case main snapshot. Tracked temporary resources remain runner-owned.
 * @evidence contracts/e2e.md#preserved-coverage Original tsconfig recording and changed-key assertions remain at the producer connection.
 */
export const test_cache_key_changes_when_the_tsconfig_changes = async () => {
  await assertCacheKeyChangesWhenTheTsconfigChanges();
};
