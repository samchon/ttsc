import { assertCacheKeyChangesWhenARecordedPluginSourceChanges } from "../../../internal/metro/internal/metro-cache";

/**
 * Verifies a Metro run's key carries the state of every plugin source a
 * previous run recorded, so a plugin's Go source edited in place re-keys the
 * next run (samchon/ttsc#1487).
 *
 * A plugin's binary is keyed on its source, so its output is a function of it,
 * but Metro's key hashed each recorded path's own state, and a directory's is
 * only its presence: after a plugin edit, a restart reused every module the old
 * binary produced. A recorded plugin source is now marked as one, and the key
 * carries its state. Exercises the real native compiler, so it runs where the
 * Go toolchain is present.
 *
 * 1. Run a transform whose plugin's Go source is the project's own copy, and
 *    assert the worker snapshot recorded that source as a tree.
 * 2. Prepare the next run, and assert the main snapshot carries the tree; write
 *    below the source's `node_modules`, and assert the key holds.
 * 3. Edit the plugin's Go source, and assert the key differs.
 *
 * @evidence contracts/testing.md#behavioral-verification After a real native transform records its copied Go source tree, ignored node_modules writes keep the key and appending to main.go changes it.
 * @evidence contracts/testing.md#independent-expectations The plugin-source build contract excludes node_modules and includes authored Go source, independently requiring equality then inequality.
 * @evidence contracts/testing.md#distinguishing-cases An ignored subtree is the negative control beside an authored Go edit in the same recorded tree.
 * @evidence contracts/testing.md#execution-ownership This named features export test_cache_key_changes_when_a_recorded_plugin_source_changes executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary The compiler must publish the actual plugin producer source identity into Metro watch metadata; a prefilled snapshot cannot prove that delivery.
 * @evidence contracts/e2e.md#shared-execution One project and initial native transform establish the tree once. Both key comparisons reuse that observation and add no native rebuild; the immutable default fixture is copied only because this case must edit its own source.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Edits target the case-owned Go copy, preserving the shared immutable producer. Its worker state is compacted before key comparison and all temporary/cache paths are runner-owned.
 * @evidence contracts/e2e.md#preserved-coverage Recorded tree membership, ignored-write equality and authored-edit inequality remain; no source edit or supported negative control was dropped.
 */
export const test_cache_key_changes_when_a_recorded_plugin_source_changes =
  async () => {
    await assertCacheKeyChangesWhenARecordedPluginSourceChanges();
  };
