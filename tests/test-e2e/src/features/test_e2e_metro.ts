import { Scenarios } from "../internal/Scenarios";
import { MetroWorkspace } from "../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../internal/metro/internal/metro-runtime";
import { case_metro_cache_key_changes_when_a_recorded_external_input_changes } from "./metro/scenes/case_metro_cache_key_changes_when_a_recorded_external_input_changes";
import { case_metro_cache_key_changes_when_a_recorded_plugin_source_changes } from "./metro/scenes/case_metro_cache_key_changes_when_a_recorded_plugin_source_changes";
import { case_metro_cache_key_changes_when_the_plugin_build_environment_changes } from "./metro/scenes/case_metro_cache_key_changes_when_the_plugin_build_environment_changes";
import { case_metro_cache_key_changes_when_the_tsconfig_changes } from "./metro/scenes/case_metro_cache_key_changes_when_the_tsconfig_changes";
import { case_metro_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes } from "./metro/scenes/case_metro_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes";
import { case_metro_cjs_build_loads_and_runs_under_require } from "./metro/scenes/case_metro_cjs_build_loads_and_runs_under_require";
import { case_metro_prepare_snapshot_compacts_worker_files_into_the_main_snapshot } from "./metro/scenes/case_metro_prepare_snapshot_compacts_worker_files_into_the_main_snapshot";
import { case_metro_snapshot_reader_keeps_inputs_across_concurrent_compaction } from "./metro/scenes/case_metro_snapshot_reader_keeps_inputs_across_concurrent_compaction";
import { case_metro_transformer_moves_upstream_locations_to_the_authored_lines } from "./metro/scenes/case_metro_transformer_moves_upstream_locations_to_the_authored_lines";
import { case_metro_transformer_passes_files_outside_the_project_through } from "./metro/scenes/case_metro_transformer_passes_files_outside_the_project_through";
import { case_metro_transformer_propagates_genuine_compile_errors } from "./metro/scenes/case_metro_transformer_propagates_genuine_compile_errors";
import { case_metro_transformer_records_implicit_dependency_guards_in_the_worker_snapshot } from "./metro/scenes/case_metro_transformer_records_implicit_dependency_guards_in_the_worker_snapshot";
import { case_metro_transformer_records_linked_inputs_in_the_worker_snapshot } from "./metro/scenes/case_metro_transformer_records_linked_inputs_in_the_worker_snapshot";
import { case_metro_transformer_records_volatile_declarations_in_the_worker_snapshot } from "./metro/scenes/case_metro_transformer_records_volatile_declarations_in_the_worker_snapshot";
import { case_metro_transformer_runs_the_ttsc_plugin_pass_on_typescript_sources } from "./metro/scenes/case_metro_transformer_runs_the_ttsc_plugin_pass_on_typescript_sources";
import { case_metro_transformer_workers_share_one_compile_per_session } from "./metro/scenes/case_metro_transformer_workers_share_one_compile_per_session";
import { case_metro_withttsc_sets_the_babel_transformer_path_to_the_package_transformer } from "./metro/scenes/case_metro_withttsc_sets_the_babel_transformer_path_to_the_package_transformer";

/**
 * Verifies the @ttsc/metro package through its built entries and real transforms.
 *
 * Every scenario takes its project from one owned workspace: the unplugin
 * fixture project is generated once as a template and each scenario replaces a
 * slot with a copy, which also discards the slot's fingerprint snapshot, so no
 * epoch or recorded input carries between scenarios. Scenarios are independent:
 * each reaches its own verdict, failures are reported under their names, and
 * the workspace is removed afterwards with its absence verified.
 *
 * 1. Open the workspace and run the transform, cache-key, snapshot and built-entry
 *    scenarios against it.
 * 2. Collect every scenario failure instead of stopping at the first.
 * 3. Remove the workspace and verify nothing remains.
 *
 * @evidence contracts/testing.md#behavioral-verification Sixteen named callbacks own transform, key, snapshot and built-entry observations; the wrapper orders them and collects scenario and workspace-cleanup failures. Key shape, output markers and recorded bits have each scene's stated limits rather than universal native execution coverage.
 * @evidence contracts/testing.md#independent-expectations Authored source literals, option values, path sets and snapshot contracts supply expectations in each scene; the wrapper does not derive an oracle from plugin output.
 * @evidence contracts/testing.md#distinguishing-cases Scenes retain their own positive/negative inputs, including same-state key controls versus changes. Exact direct-policy complements are named per scene; this parent does not certify a blanket unit population or its execution.
 * @evidence contracts/testing.md#execution-ownership This discoverable parent explicitly invokes the sixteen exported cases. Default adapter helpers load built entries with authored echo upstream, while TTSC_TEST_LAYER=unit selects authored source and explicit process scenes select their own built imports. The compaction case directly calls its owning operation; none of these distinctions is erased by the common wrapper.
 * @evidence contracts/e2e.md#necessary-boundary Native output/metadata to built adapter and concurrent session scenes retain their actual connections. Direct fingerprint/compaction meanings and PID setup are not E2E merely because they touch native files or start a setup child; the original/direct addresses remain until survival is established.
 * @evidence contracts/e2e.md#shared-execution One canonical template/base supplies copied project slots, with external/upstream/session roots owned separately. Sixteen callbacks are not sixteen transforms: key-only, direct compaction, repeated transforms and concurrent child inputs retain their actual calls. Directory counts and shared artifacts do not establish process, Program or cache-hit reductions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Slot replacement clears that slot's snapshot; scenes own option/environment restoration and their settled transform/child inputs. This parent attempts MetroWorkspace.close after scenario collection and retains both failure kinds, verifying only its owned base absence. Tracked helper roots, module retention and arbitrary descendants are not released or certified by that absence alone.
 * @evidence contracts/e2e.md#preserved-coverage All sixteen original callback addresses/order and their literal assertions remain, with needed stability, PID-premise and failure-join improvements recorded per scene. Exact direct-policy bodies and the separate concurrent 150-round boundary are recorded separately; authored counterparts are not executed survival or permission to remove donors.
 */
export async function test_e2e_metro(includeConcurrentCompaction = false): Promise<void> {
  const workspace = MetroWorkspace.open();
  const failures: Error[] = [];
  try {
    await Scenarios.collect("metro", [
      ["cache_key_changes_when_a_recorded_external_input_changes", () => case_metro_cache_key_changes_when_a_recorded_external_input_changes(workspace)],
      ["cache_key_changes_when_a_recorded_plugin_source_changes", () => case_metro_cache_key_changes_when_a_recorded_plugin_source_changes(workspace)],
      ["cache_key_changes_when_the_plugin_build_environment_changes", () => case_metro_cache_key_changes_when_the_plugin_build_environment_changes(workspace)],
      ["cache_key_changes_when_the_tsconfig_changes", () => case_metro_cache_key_changes_when_the_tsconfig_changes(workspace)],
      ["cache_key_rekeys_a_dependent_transform_when_its_input_file_changes", () => case_metro_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes(workspace)],
      ["cjs_build_loads_and_runs_under_require", () => case_metro_cjs_build_loads_and_runs_under_require(workspace)],
      ["prepare_snapshot_compacts_worker_files_into_the_main_snapshot", () => case_metro_prepare_snapshot_compacts_worker_files_into_the_main_snapshot(workspace)],
      ["transformer_moves_upstream_locations_to_the_authored_lines", () => case_metro_transformer_moves_upstream_locations_to_the_authored_lines(workspace)],
      ["transformer_passes_files_outside_the_project_through", () => case_metro_transformer_passes_files_outside_the_project_through(workspace)],
      ["transformer_propagates_genuine_compile_errors", () => case_metro_transformer_propagates_genuine_compile_errors(workspace)],
      ["transformer_records_implicit_dependency_guards_in_the_worker_snapshot", () => case_metro_transformer_records_implicit_dependency_guards_in_the_worker_snapshot(workspace)],
      ["transformer_records_linked_inputs_in_the_worker_snapshot", () => case_metro_transformer_records_linked_inputs_in_the_worker_snapshot(workspace)],
      ["transformer_records_volatile_declarations_in_the_worker_snapshot", () => case_metro_transformer_records_volatile_declarations_in_the_worker_snapshot(workspace)],
      ["transformer_runs_the_ttsc_plugin_pass_on_typescript_sources", () => case_metro_transformer_runs_the_ttsc_plugin_pass_on_typescript_sources(workspace)],
      ["transformer_workers_share_one_compile_per_session", () => case_metro_transformer_workers_share_one_compile_per_session(workspace)],
      ["withttsc_sets_the_babel_transformer_path_to_the_package_transformer", () => case_metro_withttsc_sets_the_babel_transformer_path_to_the_package_transformer(workspace)],
      ...(includeConcurrentCompaction ? [["snapshot_reader_keeps_inputs_across_concurrent_compaction", () => {
        const moduleFile = TestMetroRuntime.libPath("core/fingerprint", "mjs");
        return case_metro_snapshot_reader_keeps_inputs_across_concurrent_compaction(
          MetroWorkspace.enterBare(workspace, "concurrent-compaction"),
          MetroWorkspace.enterExternal(workspace),
          moduleFile,
        );
      }] as const] : []),
    ]);
  } catch (error) {
    failures.push(error as Error);
  }
  try {
    MetroWorkspace.close(workspace);
  } catch (error) {
    failures.push(error as Error);
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, "Metro scenarios and cleanup failed.");
}
