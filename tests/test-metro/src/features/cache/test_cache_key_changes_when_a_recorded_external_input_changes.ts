import { assertCacheKeyChangesWhenRecordedExternalInputChanges } from "../../internal/metro-cache";

/**
 * Verifies the two-run acceptance reproduction of samchon/ttsc#721, out-of-walk
 * direction: a transform input outside the project root (the shape of
 * `node_modules` declarations and monorepo sibling sources) is recorded by run
 * 1, compacted into the main snapshot, and re-hashed by the next run's key, so
 * editing only that external file re-keys the run.
 *
 * No project walk can see this class of input; only the reference-graph channel
 * (samchon/ttsc#718) can prove it relevant. Exercises the real native compiler,
 * so it runs where the Go toolchain is present (CI).
 *
 * 1. Run 1 transforms a project whose plugin reads and reports a file outside the
 *    project root; assert the worker snapshot recorded it.
 * 2. Prepare the next run (compaction): the main snapshot carries the path;
 *    compute the key.
 * 3. Edit only the external file: a fresh run's key differs and its transform
 *    carries the regenerated output.
 */
export const test_cache_key_changes_when_a_recorded_external_input_changes =
  async () => {
    await assertCacheKeyChangesWhenRecordedExternalInputChanges();
  };
