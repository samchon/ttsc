import { Scenarios } from "../internal/Scenarios";
import { LintWorkspace } from "../internal/lint/LintWorkspace";
import { nativeLintConnections } from "../internal/lint/nativeLintConnections";
import { releaseConfigLanguageBoundary } from "../internal/lint/internal/config-language-boundary";
import { releaseContributorBoundary } from "../internal/lint/internal/contributor-boundary";
import { test_lint_config_file_commonjs_config_resolves_a_javascript_spelled_sibling } from "./lint/config/case_lint_config_file_commonjs_config_resolves_a_javascript_spelled_sibling";
import { test_lint_config_file_cts_configs_load_through_ttsx } from "./lint/config/case_lint_config_file_cts_configs_load_through_ttsx";
import { test_lint_config_file_esm_javascript_configs_may_default_export_the_rules_object } from "./lint/config/case_lint_config_file_esm_javascript_configs_may_default_export_the_rules_object";
import { test_lint_config_file_extends_must_be_a_non_empty_string } from "./lint/config/case_lint_config_file_extends_must_be_a_non_empty_string";
import { test_lint_config_file_javascript_configs_may_export_the_rules_object } from "./lint/config/case_lint_config_file_javascript_configs_may_export_the_rules_object";
import { test_lint_config_file_mts_configs_load_through_ttsx } from "./lint/config/case_lint_config_file_mts_configs_load_through_ttsx";
import { test_lint_config_file_tsconfig_may_reference_a_standalone_json_file } from "./lint/config/case_lint_config_file_tsconfig_may_reference_a_standalone_json_file";
import { test_lint_config_file_typescript_configs_can_use_exported_ttsc_lint_types } from "./lint/config/case_lint_config_file_typescript_configs_can_use_exported_ttsc_lint_types";
import { test_lint_config_file_typescript_configs_may_default_export_the_rules_object } from "./lint/config/case_lint_config_file_typescript_configs_may_default_export_the_rules_object";
import { test_lint_config_file_typescript_configs_use_commonjs_globals_in_a_commonjs_package } from "./lint/config/case_lint_config_file_typescript_configs_use_commonjs_globals_in_a_commonjs_package";
import { test_lint_config_file_typescript_configs_use_import_meta_in_a_module_package } from "./lint/config/case_lint_config_file_typescript_configs_use_import_meta_in_a_module_package";
import { test_lint_config_file_typescript_config_loads_when_temp_dir_realpath_differs } from "./lint/config/case_lint_config_file_typescript_config_loads_when_temp_dir_realpath_differs";
import { test_lint_reads_an_imported_source_outside_the_tsconfig_selection } from "./lint/config/case_lint_reads_an_imported_source_outside_the_tsconfig_selection";
import { test_lint_config_discovered_lint_config_file_applies_without_tsconfig_key } from "./lint/native-plugins/config/case_lint_config_discovered_lint_config_file_applies_without_tsconfig_key";
import { test_lint_config_file_out_of_tree_tsconfig_honors_project_ignores_via_cwd_discovery } from "./lint/native-plugins/config/case_lint_config_file_out_of_tree_tsconfig_honors_project_ignores_via_cwd_discovery";
import { test_lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config } from "./lint/native-plugins/config/case_lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config";
import { test_lint_contributor_plugin_discovered_from_lint_config_ts } from "./lint/native-plugins/config/case_lint_contributor_plugin_discovered_from_lint_config_ts";
import { test_lint_contributor_plugin_rule_fires_through_single_diagnostic_stream } from "./lint/native-plugins/config/case_lint_contributor_plugin_rule_fires_through_single_diagnostic_stream";
import { test_lint_contributor_rule_decodes_user_options_through_wire_chain } from "./lint/native-plugins/config/case_lint_contributor_rule_decodes_user_options_through_wire_chain";
import { test_lint_write_commands_share_one_consumer } from "./lint/native-plugins/fix/case_lint_write_commands_share_one_consumer";
import { test_descriptor_discovers_contributors_via_plugin_config_dir_for_wrapper_tsconfig } from "./lint/plugin/case_descriptor_discovers_contributors_via_plugin_config_dir_for_wrapper_tsconfig";
import { test_descriptor_keeps_the_exit_status_when_the_evaluator_names_no_reason } from "./lint/plugin/case_descriptor_keeps_the_exit_status_when_the_evaluator_names_no_reason";
import { test_descriptor_preserves_failed_config_diagnostics_without_stdout_leaks } from "./lint/plugin/case_descriptor_preserves_failed_config_diagnostics_without_stdout_leaks";
import { test_descriptor_redirects_executable_config_stdout_to_stderr } from "./lint/plugin/case_descriptor_redirects_executable_config_stdout_to_stderr";
import { test_descriptor_rejects_colliding_contributor_namespaces_from_cjs_config } from "./lint/plugin/case_descriptor_rejects_colliding_contributor_namespaces_from_cjs_config";
import { test_descriptor_rejects_colliding_contributor_namespaces_from_typescript_config } from "./lint/plugin/case_descriptor_rejects_colliding_contributor_namespaces_from_typescript_config";
import { test_descriptor_rejects_malformed_cjs_contributors } from "./lint/plugin/case_descriptor_rejects_malformed_cjs_contributors";
import { test_descriptor_reloads_changed_cjs_contributor_selection } from "./lint/plugin/case_descriptor_reloads_changed_cjs_contributor_selection";
import { test_descriptor_reloads_changed_esm_and_typescript_contributor_selection } from "./lint/plugin/case_descriptor_reloads_changed_esm_and_typescript_contributor_selection";
import { test_lib_index_js_is_a_factory_that_returns_a_native_source_descriptor } from "./lint/plugin/case_lib_index_js_is_a_factory_that_returns_a_native_source_descriptor";
import { test_lint_mixed_diagnostics_follow_source_order } from "./lint/plugin/case_lint_mixed_diagnostics_follow_source_order";

/**
 * Own the lint package's actual config, contributor and edit connections.
 *
 * Nine language consumers observe one exact combined diagnostic stream from a
 * single native host load. Three contributor consumers observe one native wire
 * population. Remaining contexts need differing discovery roots, evaluator
 * failures, contributor selections or fix/format writes and occupy sibling
 * directories in this experiment's one consumer tree. Independent scenarios
 * continue after failure, and the owner releases their tree and output caches.
 *
 * @evidence contracts/testing.md#behavioral-verification Named cases retain their literal diagnostic, descriptor, module-error and exact edited-byte assertions against the emitted package and actual native transport; the sixteen Go cases execute their evaluator, formatter oracle and LSP connections.
 * @evidence contracts/testing.md#independent-expectations Existing authored source/configuration fixtures and literal diagnostic or expected-file assertions remain per case. The Prettier population uses its independently version-checked formatter oracle.
 * @evidence contracts/testing.md#distinguishing-cases Includes all nine config-language contexts, three contributor wire consumers, discovery-anchor conflicts, failed or changed executable modules, source ordering and independent fix/format publication. Each declaration describes its own detailed distinction.
 * @evidence contracts/testing.md#execution-ownership test_e2e_lint is the only discoverable lint experiment. It calls all thirty-four named TypeScript cases and selects sixteen exact Go names under the e2e build tag, with actual JSON execution verified by GoBoundary.
 * @evidence contracts/e2e.md#necessary-boundary Emitted descriptor evaluation, actual executable config loading, compiler-to-native diagnostics, independent Prettier formatting, real LSP stdin and disk edit publication require these connections rather than portable rule calls.
 * @evidence contracts/e2e.md#shared-execution Nine language verdicts share one project/native result and three contributor verdicts share one contributor project/native result. Every ordinary consumer occupies the one experiment tree and shares the content-keyed native producer/object cache. Distinct module/configuration/discovery and write policies retain their own invocation; the Go population uses one binary with one pinned formatter-oracle batch.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Sibling manifests/configs do not become another consumer's ancestors. Source edits, wrapper configs and alternate-temp links are case-owned; the root is removed and absence verified in finally. Completed language/contributor outputs are cleared with their experiment owner, including failures.
 * @evidence contracts/e2e.md#preserved-coverage All original TypeScript assertions remain called once under their names and all sixteen package-owned Go assertions remain explicit. Independent failure collection and verified workspace cleanup add ownership without replacing expected diagnostics, byte comparisons, source immutability or negative cases.
 */
export async function test_e2e_lint(): Promise<void> {
  LintWorkspace.open();
  const failures: unknown[] = [];
  try {
    await Scenarios.collect("lint", [
      ["native_evaluator_formatter_and_lsp_connections", nativeLintConnections],
      ["lint_config_file_commonjs_config_resolves_a_javascript_spelled_sibling", test_lint_config_file_commonjs_config_resolves_a_javascript_spelled_sibling],
      ["lint_config_file_cts_configs_load_through_ttsx", test_lint_config_file_cts_configs_load_through_ttsx],
      ["lint_config_file_esm_javascript_configs_may_default_export_the_rules_object", test_lint_config_file_esm_javascript_configs_may_default_export_the_rules_object],
      ["lint_config_file_extends_must_be_a_non_empty_string", test_lint_config_file_extends_must_be_a_non_empty_string],
      ["lint_config_file_javascript_configs_may_export_the_rules_object", test_lint_config_file_javascript_configs_may_export_the_rules_object],
      ["lint_config_file_mts_configs_load_through_ttsx", test_lint_config_file_mts_configs_load_through_ttsx],
      ["lint_config_file_tsconfig_may_reference_a_standalone_json_file", test_lint_config_file_tsconfig_may_reference_a_standalone_json_file],
      ["lint_config_file_typescript_configs_can_use_exported_ttsc_lint_types", test_lint_config_file_typescript_configs_can_use_exported_ttsc_lint_types],
      ["lint_config_file_typescript_configs_may_default_export_the_rules_object", test_lint_config_file_typescript_configs_may_default_export_the_rules_object],
      ["lint_config_file_typescript_configs_use_commonjs_globals_in_a_commonjs_package", test_lint_config_file_typescript_configs_use_commonjs_globals_in_a_commonjs_package],
      ["lint_config_file_typescript_configs_use_import_meta_in_a_module_package", test_lint_config_file_typescript_configs_use_import_meta_in_a_module_package],
      ["lint_config_file_typescript_config_loads_when_temp_dir_realpath_differs", test_lint_config_file_typescript_config_loads_when_temp_dir_realpath_differs],
      ["lint_reads_an_imported_source_outside_the_tsconfig_selection", test_lint_reads_an_imported_source_outside_the_tsconfig_selection],
      ["lint_config_discovered_lint_config_file_applies_without_tsconfig_key", test_lint_config_discovered_lint_config_file_applies_without_tsconfig_key],
      ["lint_config_file_out_of_tree_tsconfig_honors_project_ignores_via_cwd_discovery", test_lint_config_file_out_of_tree_tsconfig_honors_project_ignores_via_cwd_discovery],
      ["lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config", test_lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config],
      ["lint_contributor_plugin_discovered_from_lint_config_ts", test_lint_contributor_plugin_discovered_from_lint_config_ts],
      ["lint_contributor_plugin_rule_fires_through_single_diagnostic_stream", test_lint_contributor_plugin_rule_fires_through_single_diagnostic_stream],
      ["lint_contributor_rule_decodes_user_options_through_wire_chain", test_lint_contributor_rule_decodes_user_options_through_wire_chain],
      ["lint_write_commands_share_one_consumer", test_lint_write_commands_share_one_consumer],
      ["descriptor_discovers_contributors_via_plugin_config_dir_for_wrapper_tsconfig", test_descriptor_discovers_contributors_via_plugin_config_dir_for_wrapper_tsconfig],
      ["descriptor_keeps_the_exit_status_when_the_evaluator_names_no_reason", test_descriptor_keeps_the_exit_status_when_the_evaluator_names_no_reason],
      ["descriptor_preserves_failed_config_diagnostics_without_stdout_leaks", test_descriptor_preserves_failed_config_diagnostics_without_stdout_leaks],
      ["descriptor_redirects_executable_config_stdout_to_stderr", test_descriptor_redirects_executable_config_stdout_to_stderr],
      ["descriptor_rejects_colliding_contributor_namespaces_from_cjs_config", test_descriptor_rejects_colliding_contributor_namespaces_from_cjs_config],
      ["descriptor_rejects_colliding_contributor_namespaces_from_typescript_config", test_descriptor_rejects_colliding_contributor_namespaces_from_typescript_config],
      ["descriptor_rejects_malformed_cjs_contributors", test_descriptor_rejects_malformed_cjs_contributors],
      ["descriptor_reloads_changed_cjs_contributor_selection", test_descriptor_reloads_changed_cjs_contributor_selection],
      ["descriptor_reloads_changed_esm_and_typescript_contributor_selection", test_descriptor_reloads_changed_esm_and_typescript_contributor_selection],
      ["lib_index_js_is_a_factory_that_returns_a_native_source_descriptor", test_lib_index_js_is_a_factory_that_returns_a_native_source_descriptor],
      ["lint_mixed_diagnostics_follow_source_order", test_lint_mixed_diagnostics_follow_source_order],
    ]);
  } catch (error) {
    failures.push(error);
  } finally {
    releaseConfigLanguageBoundary();
    releaseContributorBoundary();
    try { LintWorkspace.close(); } catch (error) { failures.push(new Error("lint workspace cleanup", { cause: error })); }
  }
  if (failures.length) throw new AggregateError(failures, "Lint package boundary failures");
}
