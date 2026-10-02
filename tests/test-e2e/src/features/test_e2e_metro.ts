import { Scenarios } from "../internal/Scenarios";
import { MetroWorkspace } from "../internal/metro/internal/MetroWorkspace";
import { case_metro_cache_key_changes_when_a_recorded_external_input_changes } from "./metro/scenes/case_metro_cache_key_changes_when_a_recorded_external_input_changes";
import { case_metro_cache_key_changes_when_a_recorded_plugin_source_changes } from "./metro/scenes/case_metro_cache_key_changes_when_a_recorded_plugin_source_changes";
import { case_metro_cache_key_changes_when_the_plugin_build_environment_changes } from "./metro/scenes/case_metro_cache_key_changes_when_the_plugin_build_environment_changes";
import { case_metro_cache_key_changes_when_the_tsconfig_changes } from "./metro/scenes/case_metro_cache_key_changes_when_the_tsconfig_changes";
import { case_metro_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes } from "./metro/scenes/case_metro_cache_key_rekeys_a_dependent_transform_when_its_input_file_changes";
import { case_metro_cjs_build_loads_and_runs_under_require } from "./metro/scenes/case_metro_cjs_build_loads_and_runs_under_require";
import { case_metro_prepare_snapshot_compacts_worker_files_into_the_main_snapshot } from "./metro/scenes/case_metro_prepare_snapshot_compacts_worker_files_into_the_main_snapshot";
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
 * @evidence contracts/testing.md#behavioral-verification Each scenario loads the built Metro entries and drives real transforms, snapshot recorders or worker processes and asserts keys, transformed output, locations or recorded inputs; this entry adds only the cleanup check.
 * @evidence contracts/testing.md#independent-expectations Expectations come from authored sources, plugin outputs and recorded-input contracts stated in each scenario; the experiment adds none.
 * @evidence contracts/testing.md#distinguishing-cases Each scenario states its own positive, negative and boundary inputs; recorded-input and key-change scenarios have unchanged-key twins in the unit population.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro is the discoverable entry of the single test-e2e module; its scenarios are exported case functions selected by the same Evidence claim, while portable fingerprint and gating decisions remain source units in test-metro.
 * @evidence contracts/e2e.md#necessary-boundary The built transformer, worker snapshot recorder and native compiler meet only in real runs; each scenario states which connection it proves.
 * @evidence contracts/e2e.md#shared-execution Sixteen former tests created twenty-one separate temporary directories (seventeen projects plus four external or upstream input directories); they now draw from one owned workspace directory, with three confined transform-session directories still allocated by the scenarios that need an isolated temporary root. The native transforms themselves remain, one per scenario input, because each runs a distinct plugin list or source whose recorded state is asserted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Slot replacement discards earlier snapshots before each scenario, each scenario restores the worker options it changes, and the experiment removes the workspace and verifies its absence in finally even after scenario failures.
 * @evidence contracts/e2e.md#preserved-coverage Every former entry is a scenario with its assertions unchanged; assertion helpers formerly duplicated for the unit population were removed from this suite because test-metro owns them.
 */
export async function test_e2e_metro(): Promise<void> {
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
