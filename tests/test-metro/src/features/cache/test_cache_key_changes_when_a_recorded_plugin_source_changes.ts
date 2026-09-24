import { assertCacheKeyChangesWhenARecordedPluginSourceChanges } from "../../internal/metro-cache";

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
 */
export const test_cache_key_changes_when_a_recorded_plugin_source_changes =
  async () => {
    await assertCacheKeyChangesWhenARecordedPluginSourceChanges();
  };
