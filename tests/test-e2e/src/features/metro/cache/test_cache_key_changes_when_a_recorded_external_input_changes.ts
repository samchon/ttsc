import { assertCacheKeyChangesWhenRecordedExternalInputChanges } from "../../../internal/metro/internal/metro-cache";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Native reader/reporter output records the exact external/config input set and Go source tree, compaction retains the external path, its edit changes the key and output becomes PLUGIN:SECOND.
 * @evidence contracts/testing.md#independent-expectations The authored external helper, exact project/config paths and FIRST/SECOND markers independently identify dependency observation and regeneration.
 * @evidence contracts/testing.md#distinguishing-cases An external helper absent from the program walk contrasts in-project dependency invalidation; exact set assertions prevent over-recording.
 * @evidence contracts/testing.md#execution-ownership This named features export test_cache_key_changes_when_a_recorded_external_input_changes executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary Actual plugin metadata and transformed output must traverse compiler-to-Unplugin-to-Metro delivery before an out-of-walk input can be guarded.
 * @evidence contracts/e2e.md#shared-execution One project, reader/reporter descriptors and the suite shared plugin producer serve both external states; changing helper bytes requires a new compile generation, while compaction performs no native build.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the case external file is edited; its fixture identity and project path isolate recorded inputs. Worker options are restored and all tracked temporary directories remain owned by the runner until process cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Original exact worker set, source-tree membership, compaction cleanup, main membership, changed key and both output markers remain.
 */
export const test_cache_key_changes_when_a_recorded_external_input_changes =
  async () => {
    await assertCacheKeyChangesWhenRecordedExternalInputChanges();
  };
