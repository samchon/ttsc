import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestProject } from "../../../utils/src/TestProject";
import { test_e2e_compiler_stub } from "./test_e2e_compiler_stub";
import { test_e2e_evidence } from "./test_e2e_evidence";
import { test_e2e_installation } from "./test_e2e_installation";
import { test_residenttransformprocess_lifecycle } from "./ttsc/api/test_residenttransformprocess_lifecycle";
import { test_residenttransformprocess_request_bounds } from "./ttsc/api/test_residenttransformprocess_request_bounds";
import { test_testproject_exit_removes_joined_temporary_roots } from "./ttsc/api/test_testproject_exit_removes_joined_temporary_roots";
import { test_testproject_exit_retains_owned_roots_with_unknown_descendants } from "./ttsc/api/test_testproject_exit_retains_owned_roots_with_unknown_descendants";
import { test_ttsccompiler_source_plugin_discovery_shares_one_project } from "./ttsc/api/test_ttsccompiler_source_plugin_discovery_shares_one_project";
import { test_compiler_consumer_local_native_compiler_receives_the_launcher_contract } from "./ttsc/compiler/test_compiler_consumer_local_native_compiler_receives_the_launcher_contract";
import { test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries } from "./ttsc/compiler/test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries";
import { test_consumer_compiler_preserves_external_emit_provenance_process_control } from "./ttsc/compiler/test_consumer_compiler_preserves_external_emit_provenance_process_control";
import { test_ttsc_watch_rebuilds_for_a_plugin_module_outside_its_package } from "./ttsc/native-plugins/compiler/test_ttsc_watch_rebuilds_for_a_plugin_module_outside_its_package";
import { test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source } from "./ttsc/native-plugins/compiler/test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source";
import { test_plugin_corpus_auto_discovered_lint_prefer_const_tracks_lexical_bindings } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_auto_discovered_lint_prefer_const_tracks_lexical_bindings";
import { test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists";
import { test_plugin_corpus_check_watch_fallback_keeps_forwarded_compiler_flags } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_check_watch_fallback_keeps_forwarded_compiler_flags";
import { test_plugin_corpus_check_watch_invalidates_json_input_membership_without_restarting_resident } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_check_watch_invalidates_json_input_membership_without_restarting_resident";
import { test_plugin_corpus_check_watch_preserves_duplicate_resident_entries } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_check_watch_preserves_duplicate_resident_entries";
import { test_plugin_corpus_check_watch_rebuilds_a_plugin_binary_the_cache_removed } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_check_watch_rebuilds_a_plugin_binary_the_cache_removed";
import { test_plugin_corpus_check_watch_records_use_of_its_plugin_binary } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_check_watch_records_use_of_its_plugin_binary";
import { test_plugin_corpus_check_watch_reloads_changed_lint_config_contributors } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_check_watch_reloads_changed_lint_config_contributors";
import { test_plugin_corpus_check_watch_reuses_resident_program } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_check_watch_reuses_resident_program";
import { test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed";
import { test_plugin_corpus_missing_go_toolchain_points_users_at_the_install_hint } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_missing_go_toolchain_points_users_at_the_install_hint";
import { test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform";
import { test_plugin_corpus_package_ttsc_plugin_auto_discovers_ttsc_lint_config_files } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_package_ttsc_plugin_auto_discovers_ttsc_lint_config_files";
import { test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output";
import { test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx";
import { test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option";
import { test_plugin_corpus_ttsx_check_plugin_pass_leaves_build_info_untouched } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_ttsx_check_plugin_pass_leaves_build_info_untouched";
import { test_plugin_corpus_ttsx_nested_project_reuses_the_prepared_workspace_cache } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_ttsx_nested_project_reuses_the_prepared_workspace_cache";
import { test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end";
import { test_plugin_corpus_ttsx_runs_a_host_that_declares_no_emit_provenance } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_ttsx_runs_a_host_that_declares_no_emit_provenance";
import { test_plugin_corpus_watch_rebuilds_for_declared_markdown_and_swagger_inputs } from "./ttsc/native-plugins/corpus-misc/test_plugin_corpus_watch_rebuilds_for_declared_markdown_and_swagger_inputs";
import { test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry } from "./ttsc/native-plugins/corpus-misc/test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry";
import { test_project_rule_lifecycle_surfaces_through_package_discovery_cli_api_and_watch } from "./ttsc/native-plugins/corpus-misc/test_project_rule_lifecycle_surfaces_through_package_discovery_cli_api_and_watch";
import { test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr } from "./ttsc/native-plugins/corpus-source/test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr";
import { test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache } from "./ttsc/native-plugins/corpus-source/test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache";
import { test_plugin_corpus_emit_watch_reuses_plugin_selection_until_config_changes } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_emit_watch_reuses_plugin_selection_until_config_changes";
import { test_plugin_corpus_ttsc_lint_applies_forwarded_strict_flag } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsc_lint_applies_forwarded_strict_flag";
import { test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics";
import { test_plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check";
import { test_plugin_corpus_ttsc_lint_format_subcommand_rewrites_source } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsc_lint_format_subcommand_rewrites_source";
import { test_plugin_corpus_ttsc_lint_no_emit_skips_redundant_tsgo_check } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsc_lint_no_emit_skips_redundant_tsgo_check";
import { test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache";
import { test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path";
import { test_plugin_corpus_ttsx_check_host_accepts_sibling_sources_without_rootdir } from "./ttsc/native-plugins/corpus-ttsc/test_plugin_corpus_ttsx_check_host_accepts_sibling_sources_without_rootdir";
import { test_native_transformer_project_go_sidecar_handles_project_build } from "./ttsc/native-plugins/driver/test_native_transformer_project_go_sidecar_handles_project_build";
import { test_ttscservice_answers_a_file_named_through_a_linked_project_root } from "./ttsc/native-plugins/service-incremental/test_ttscservice_answers_a_file_named_through_a_linked_project_root";
import { test_transform_apis_resolve_relative_node_binary_from_project_root } from "./ttsc/native-plugins/service/test_transform_apis_resolve_relative_node_binary_from_project_root";
import { test_ttscservice_rejects_when_the_project_does_not_compile } from "./ttsc/native-plugins/service/test_ttscservice_rejects_when_the_project_does_not_compile";
import { test_ttscservice_transforms_a_file_through_the_resident_host } from "./ttsc/native-plugins/service/test_ttscservice_transforms_a_file_through_the_resident_host";
import { test_buildsourceplugin_reclaims_dead_legacy_plugin_lock } from "./ttsc/native-plugins/source-plugin/test_buildsourceplugin_reclaims_dead_legacy_plugin_lock";
import { test_buildsourceplugin_waiter_recovers_when_holder_fails_and_releases } from "./ttsc/native-plugins/source-plugin/test_buildsourceplugin_waiter_recovers_when_holder_fails_and_releases";
import { test_buildsourceplugin_waiter_reuses_binary_published_during_release } from "./ttsc/native-plugins/source-plugin/test_buildsourceplugin_waiter_reuses_binary_published_during_release";
import { test_gobuildcache_prunes_lru_objects_outside_active_build_leases } from "./ttsc/native-plugins/source-plugin/test_gobuildcache_prunes_lru_objects_outside_active_build_leases";
import { test_package_artifact_gc_preserves_active_native_builds } from "./ttsc/native-plugins/source-plugin/test_package_artifact_gc_preserves_active_native_builds";
import { test_source_package_artifact_publisher_seals_real_builder_actions } from "./ttsc/native-plugins/source-plugin/test_source_package_artifact_publisher_seals_real_builder_actions";
import { test_source_package_artifacts_selects_only_matching_admitted_packs } from "./ttsc/native-plugins/source-plugin/test_source_package_artifacts_selects_only_matching_admitted_packs";
import { test_ttsc_reclaims_dead_legacy_source_plugin_lock_e2e } from "./ttsc/native-plugins/source-plugin/test_ttsc_reclaims_dead_legacy_source_plugin_lock_e2e";
import { test_ttsc_utility_plugins_paths_side_loads_into_driver_host } from "./ttsc/native-plugins/utility-host/test_ttsc_utility_plugins_paths_side_loads_into_driver_host";
import { test_ttsc_descriptor_input_report_preserves_order_and_failure } from "./ttsc/native-plugins/utility/test_ttsc_descriptor_input_report_preserves_order_and_failure";
import { test_ttsc_lint_config_evaluator_keeps_bootstrap_out_of_the_parent_descriptor_channel } from "./ttsc/native-plugins/utility/test_ttsc_lint_config_evaluator_keeps_bootstrap_out_of_the_parent_descriptor_channel";
import { test_ttsc_lint_descriptor_tracks_external_discovery_candidates } from "./ttsc/native-plugins/utility/test_ttsc_lint_descriptor_tracks_external_discovery_candidates";
import { test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build } from "./ttsc/native-plugins/utility/test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build";
import { test_loadprojectplugins_reports_the_directories_its_plugin_builds_key_on } from "./ttsc/project/test_loadprojectplugins_reports_the_directories_its_plugin_builds_key_on";
import { test_loadprojectplugins_tracks_bun_esm_descriptor_dependencies } from "./ttsc/project/test_loadprojectplugins_tracks_bun_esm_descriptor_dependencies";
import { test_plugin_descriptor_failures_propagate_and_cleanup_ttsx_temp } from "./ttsc/project/test_plugin_descriptor_failures_propagate_and_cleanup_ttsx_temp";
import { test_resolution_recorder_observes_require_resolve_through_the_supported_hooks } from "./ttsc/project/test_resolution_recorder_observes_require_resolve_through_the_supported_hooks";
import { test_spawn_sync_resilient_broker_preserves_process_contract } from "./ttsc/project/test_spawn_sync_resilient_broker_preserves_process_contract";
import { case_watch_topology_worker_owns_responsive_ordered_lifetimes } from "./ttsc/scenes/case_watch_topology_worker_owns_responsive_ordered_lifetimes";
import { test_ttscserver_exits_on_exit_while_stdin_stays_open } from "./ttsc/ttscserver/test_ttscserver_exits_on_exit_while_stdin_stays_open";
import { test_ttscserver_exits_on_stdin_close } from "./ttsc/ttscserver/test_ttscserver_exits_on_stdin_close";
import { test_ttscserver_initializes_and_shuts_down } from "./ttsc/ttscserver/test_ttscserver_initializes_and_shuts_down";
import { test_ttscserver_launcher_resolves_platform_binary_without_env_override } from "./ttsc/ttscserver/test_ttscserver_launcher_resolves_platform_binary_without_env_override";
import { test_ttscserver_session_reports_its_own_failure_before_its_shutdowns } from "./ttsc/ttscserver/test_ttscserver_session_reports_its_own_failure_before_its_shutdowns";
import { test_vscode_install_script_installs_default_bundled_vsix } from "./ttsc/ttscserver/test_vscode_install_script_installs_default_bundled_vsix";
import { test_ttsx_coverage_maps_preserve_entry_and_dependency_sources_in_shared_hosts } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_coverage_maps_preserve_entry_and_dependency_sources_in_shared_hosts";
import { test_ttsx_forks_a_child_whose_entry_path_is_javascript } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_forks_a_child_whose_entry_path_is_javascript";
import { test_ttsx_gives_a_javascript_commonjs_module_an_import_reaches_nodes_require } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_gives_a_javascript_commonjs_module_an_import_reaches_nodes_require";
import { test_ttsx_keeps_a_commonjs_entry_the_main_module_under_an_import_preload } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_keeps_a_commonjs_entry_the_main_module_under_an_import_preload";
import { test_ttsx_missing_import_branches_preserve_native_errors_in_one_host } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_missing_import_branches_preserve_native_errors_in_one_host";
import { test_ttsx_preloads_every_require_spelling_before_the_entry } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_preloads_every_require_spelling_before_the_entry";
import { test_ttsx_propagates_the_source_loader_to_a_child_process } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_propagates_the_source_loader_to_a_child_process";
import { test_ttsx_register_runs_checked_commonjs_and_esm_node_entries } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_register_runs_checked_commonjs_and_esm_node_entries";
import { test_ttsx_runs_a_javascript_entry_with_its_own_argv } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_runs_a_javascript_entry_with_its_own_argv";
import { test_ttsx_runs_the_entry_as_the_main_module } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_runs_the_entry_as_the_main_module";
import { test_ttsx_stack_maps_preserve_entry_and_dependency_positions_in_shared_hosts } from "./ttsc/ttsx-runtime/node-compatibility/test_ttsx_stack_maps_preserve_entry_and_dependency_positions_in_shared_hosts";
import { test_commonjs_runtime_corpus_preserves_source_ownership_across_project_profiles } from "./ttsc/ttsx-runtime/test_commonjs_runtime_corpus_preserves_source_ownership_across_project_profiles";
import { test_external_response_provenance_preserves_the_actual_producer } from "./ttsc/ttsx-runtime/test_external_response_provenance_preserves_the_actual_producer";
import { test_runner_corpus_invalid_tsconfig_prevents_entry_execution } from "./ttsc/ttsx-runtime/test_runner_corpus_invalid_tsconfig_prevents_entry_execution";
import { test_runtime_owner_preload_claims_before_program_and_rejects_a_missing_run } from "./ttsc/ttsx-runtime/test_runtime_owner_preload_claims_before_program_and_rejects_a_missing_run";
import { test_ttsc_clean_removes_the_runtime_directories_no_run_owns } from "./ttsc/ttsx-runtime/test_ttsc_clean_removes_the_runtime_directories_no_run_owns";
import { test_ttsx_and_register_remove_a_run_directory_whose_owners_are_gone } from "./ttsc/ttsx-runtime/test_ttsx_and_register_remove_a_run_directory_whose_owners_are_gone";
import { test_ttsx_builds_a_failing_project_once_for_every_file_it_owns } from "./ttsc/ttsx-runtime/test_ttsx_builds_a_failing_project_once_for_every_file_it_owns";
import { test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it } from "./ttsc/ttsx-runtime/test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it";
import { test_ttsx_classifies_a_symlinked_entry_from_the_target_package_type } from "./ttsc/ttsx-runtime/test_ttsx_classifies_a_symlinked_entry_from_the_target_package_type";
import { test_ttsx_classifies_the_entry_by_a_forwarded_module_flag } from "./ttsc/ttsx-runtime/test_ttsx_classifies_the_entry_by_a_forwarded_module_flag";
import { test_ttsx_compiles_and_checks_a_typescript_preload_outside_include } from "./ttsc/ttsx-runtime/test_ttsx_compiles_and_checks_a_typescript_preload_outside_include";
import { test_ttsx_compiles_the_whole_project_when_rootdir_is_a_symlink } from "./ttsc/ttsx-runtime/test_ttsx_compiles_the_whole_project_when_rootdir_is_a_symlink";
import { test_ttsx_decorator_orphan_reexports_honor_the_owning_project } from "./ttsc/ttsx-runtime/test_ttsx_decorator_orphan_reexports_honor_the_owning_project";
import { test_ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map } from "./ttsc/ttsx-runtime/test_ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map";
import { test_ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate } from "./ttsc/ttsx-runtime/test_ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate";
import { test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error } from "./ttsc/ttsx-runtime/test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error";
import { test_ttsx_executes_standard_decorators_in_source_dependencies } from "./ttsc/ttsx-runtime/test_ttsx_executes_standard_decorators_in_source_dependencies";
import { test_ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package } from "./ttsc/ttsx-runtime/test_ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package";
import { test_ttsx_failure_cleanup_pins_a_linked_run_index } from "./ttsc/ttsx-runtime/test_ttsx_failure_cleanup_pins_a_linked_run_index";
import { test_ttsx_failure_cleanup_retains_physical_cache_generation } from "./ttsc/ttsx-runtime/test_ttsx_failure_cleanup_retains_physical_cache_generation";
import { test_ttsx_follows_directory_references_nested_solutions_and_cycles } from "./ttsc/ttsx-runtime/test_ttsx_follows_directory_references_nested_solutions_and_cycles";
import { test_ttsx_forwards_an_unknown_flag_to_tsgo } from "./ttsc/ttsx-runtime/test_ttsx_forwards_an_unknown_flag_to_tsgo";
import { test_ttsx_keeps_a_run_directory_another_run_named_by_the_same_pid } from "./ttsc/ttsx-runtime/test_ttsx_keeps_a_run_directory_another_run_named_by_the_same_pid";
import { test_ttsx_lets_a_javascript_entry_under_an_import_preload_require_typescript } from "./ttsc/ttsx-runtime/test_ttsx_lets_a_javascript_entry_under_an_import_preload_require_typescript";
import { test_ttsx_manifest_less_child_runs_the_edited_source_on_the_next_run } from "./ttsc/ttsx-runtime/test_ttsx_manifest_less_child_runs_the_edited_source_on_the_next_run";
import { test_ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root } from "./ttsc/ttsx-runtime/test_ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root";
import { test_ttsx_no_plugins_skips_plugin_loading } from "./ttsc/ttsx-runtime/test_ttsx_no_plugins_skips_plugin_loading";
import { test_ttsx_preserves_an_empty_nested_node_modules_cache_boundary } from "./ttsc/ttsx-runtime/test_ttsx_preserves_an_empty_nested_node_modules_cache_boundary";
import { test_ttsx_preserves_custom_node_builtin_remaps } from "./ttsc/ttsx-runtime/test_ttsx_preserves_custom_node_builtin_remaps";
import { test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink } from "./ttsc/ttsx-runtime/test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink";
import { test_ttsx_rebuilds_a_root_the_program_rewrites_between_child_processes } from "./ttsc/ttsx-runtime/test_ttsx_rebuilds_a_root_the_program_rewrites_between_child_processes";
import { test_ttsx_reclaims_the_directory_of_a_force_terminated_run } from "./ttsc/ttsx-runtime/test_ttsx_reclaims_the_directory_of_a_force_terminated_run";
import { test_ttsx_register_executes_excluded_standard_decorators } from "./ttsc/ttsx-runtime/test_ttsx_register_executes_excluded_standard_decorators";
import { test_ttsx_register_runs_multiple_out_of_include_mocha_roots } from "./ttsc/ttsx-runtime/test_ttsx_register_runs_multiple_out_of_include_mocha_roots";
import { test_ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes } from "./ttsc/ttsx-runtime/test_ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes";
import { test_ttsx_resolves_config_dir_paths_for_an_installed_package_root } from "./ttsc/ttsx-runtime/test_ttsx_resolves_config_dir_paths_for_an_installed_package_root";
import { test_ttsx_runs_a_generated_file_with_the_referenced_project_that_owns_it } from "./ttsc/ttsx-runtime/test_ttsx_runs_a_generated_file_with_the_referenced_project_that_owns_it";
import { test_ttsx_runs_a_source_file_the_entry_generates_at_runtime } from "./ttsc/ttsx-runtime/test_ttsx_runs_a_source_file_the_entry_generates_at_runtime";
import { test_ttsx_runs_an_entry_that_is_itself_a_symlink } from "./ttsc/ttsx-runtime/test_ttsx_runs_an_entry_that_is_itself_a_symlink";
import { test_ttsx_runs_an_entry_with_the_referenced_project_that_owns_it } from "./ttsc/ttsx-runtime/test_ttsx_runs_an_entry_with_the_referenced_project_that_owns_it";
import { test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options } from "./ttsc/ttsx-runtime/test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options";
import { test_ttsx_runs_through_a_linked_run_index } from "./ttsc/ttsx-runtime/test_ttsx_runs_through_a_linked_run_index";
import { test_ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory } from "./ttsc/ttsx-runtime/test_ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory";
import { test_ttsx_serves_a_source_whose_twin_has_another_typescript_extension } from "./ttsc/ttsx-runtime/test_ttsx_serves_a_source_whose_twin_has_another_typescript_extension";
import { test_ttsx_shares_one_dependency_build_across_concurrent_processes } from "./ttsc/ttsx-runtime/test_ttsx_shares_one_dependency_build_across_concurrent_processes";
import { test_ttsx_standard_decorators_in_orphans_do_not_cache_imported_values } from "./ttsc/ttsx-runtime/test_ttsx_standard_decorators_in_orphans_do_not_cache_imported_values";
import { test_ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered } from "./ttsc/ttsx-runtime/test_ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered";
import { test_ttsx_ttsc_cache_dir_relocates_the_runtime_cache } from "./ttsc/ttsx-runtime/test_ttsx_ttsc_cache_dir_relocates_the_runtime_cache";
import { test_ttsx_virtual_layout_mirrors_a_file_symlink_project_entry } from "./ttsc/ttsx-runtime/test_ttsx_virtual_layout_mirrors_a_file_symlink_project_entry";
import { test_watch_topology_keeps_case_sensitive_inputs_outside_case_distinct_outputs } from "./ttsc/watch/test_watch_topology_keeps_case_sensitive_inputs_outside_case_distinct_outputs";
import { test_watch_topology_keeps_compiler_inputs_when_outdir_contains_project } from "./ttsc/watch/test_watch_topology_keeps_compiler_inputs_when_outdir_contains_project";
import { test_watch_topology_preserves_authoritative_inputs_and_json_outputs } from "./ttsc/watch/test_watch_topology_preserves_authoritative_inputs_and_json_outputs";
import { test_watch_topology_preserves_case_sensitive_project_inputs } from "./ttsc/watch/test_watch_topology_preserves_case_sensitive_project_inputs";
import { test_watch_topology_registers_physical_watch_paths } from "./ttsc/watch/test_watch_topology_registers_physical_watch_paths";
import { test_watch_topology_reports_deleted_config_and_recreation } from "./ttsc/watch/test_watch_topology_reports_deleted_config_and_recreation";
import { test_watch_topology_tracks_external_inputs_across_project_references } from "./ttsc/watch/test_watch_topology_tracks_external_inputs_across_project_references";
import { test_watch_topology_watches_reload_symlink_targets } from "./ttsc/watch/test_watch_topology_watches_reload_symlink_targets";
import { test_bun_adapter_forwards_bundler_build_start } from "./unplugin/native-plugins/adapters/test_bun_adapter_forwards_bundler_build_start";
import { test_bun_native_host_owns_build_and_runtime_sessions } from "./unplugin/native-plugins/adapters/test_bun_native_host_owns_build_and_runtime_sessions";
import { test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order } from "./unplugin/native-plugins/adapters/test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order";
import { test_bun_register_preload_only_registers_a_single_default_plugin } from "./unplugin/native-plugins/adapters/test_bun_register_preload_only_registers_a_single_default_plugin";
import { test_bun_runtime_does_not_rehash_the_project_per_module } from "./unplugin/native-plugins/adapters/test_bun_runtime_does_not_rehash_the_project_per_module";
import { test_packaged_entrypoints_publish_module_faithful_declarations } from "./unplugin/native-plugins/adapters/test_packaged_entrypoints_publish_module_faithful_declarations";
import { test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge } from "./unplugin/native-plugins/adapters/test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge";
import { test_rollup_disposes_at_the_right_boundary } from "./unplugin/native-plugins/adapters/test_rollup_disposes_at_the_right_boundary";
import { test_turbopack_loader_keeps_its_worker_through_a_failed_compile } from "./unplugin/native-plugins/adapters/test_turbopack_loader_keeps_its_worker_through_a_failed_compile";
import { test_turbopack_loader_passes_through_an_out_of_program_module } from "./unplugin/native-plugins/adapters/test_turbopack_loader_passes_through_an_out_of_program_module";
import { test_turbopack_loader_proves_its_own_records_under_a_session } from "./unplugin/native-plugins/adapters/test_turbopack_loader_proves_its_own_records_under_a_session";
import { test_turbopack_loader_signals_a_change_before_turbopacks_baseline } from "./unplugin/native-plugins/adapters/test_turbopack_loader_signals_a_change_before_turbopacks_baseline";
import { test_vite_build_serves_wrapper_queries_from_the_host } from "./unplugin/native-plugins/adapters/test_vite_build_serves_wrapper_queries_from_the_host";
import { test_vite_serve_first_request_survives_missing_resolution_candidates } from "./unplugin/native-plugins/adapters/test_vite_serve_first_request_survives_missing_resolution_candidates";
import { test_vite_serve_ignores_an_unrelated_missing_file_creation } from "./unplugin/native-plugins/adapters/test_vite_serve_ignores_an_unrelated_missing_file_creation";
import { test_vite_serve_reports_errors_at_the_authored_line } from "./unplugin/native-plugins/adapters/test_vite_serve_reports_errors_at_the_authored_line";
import { test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears } from "./unplugin/native-plugins/adapters/test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears";
import { test_vite_serve_survives_missing_candidates_after_a_server_restart } from "./unplugin/native-plugins/adapters/test_vite_serve_survives_missing_candidates_after_a_server_restart";
import { test_webpack_filesystem_cache_control_serves_stale_without_a_graph } from "./unplugin/native-plugins/adapters/test_webpack_filesystem_cache_control_serves_stale_without_a_graph";
import { test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge } from "./unplugin/native-plugins/adapters/test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge";
import { test_webpack_watch_rebuilds_through_a_type_only_edge } from "./unplugin/native-plugins/adapters/test_webpack_watch_rebuilds_through_a_type_only_edge";
import { test_webpack_watch_reuses_the_generation_across_rebuilds } from "./unplugin/native-plugins/adapters/test_webpack_watch_reuses_the_generation_across_rebuilds";
import { test_real_native_envelope_shared_corpus } from "./unplugin/native-plugins/envelope/test_real_native_envelope_shared_corpus";
import { test_directory_observer_watches_only_admitted_directories } from "./unplugin/native-plugins/transform/test_directory_observer_watches_only_admitted_directories";
import { test_host_input_tracker_real_backends_agree } from "./unplugin/native-plugins/transform/test_host_input_tracker_real_backends_agree";
import { test_linux_trackers_watch_no_package_tree } from "./unplugin/native-plugins/transform/test_linux_trackers_watch_no_package_tree";
import { test_linux_watch_helper_keeps_every_watch_honest } from "./unplugin/native-plugins/transform/test_linux_watch_helper_keeps_every_watch_honest";
import { test_transformttsc_a_failed_compile_that_raced_its_repair_is_compiled_again } from "./unplugin/native-plugins/transform/test_transformttsc_a_failed_compile_that_raced_its_repair_is_compiled_again";
import { test_transformttsc_a_linked_project_keeps_its_notification_coverage } from "./unplugin/native-plugins/transform/test_transformttsc_a_linked_project_keeps_its_notification_coverage";
import { test_transformttsc_a_new_process_witnesses_the_dependencies_its_record_names } from "./unplugin/native-plugins/transform/test_transformttsc_a_new_process_witnesses_the_dependencies_its_record_names";
import { test_transformttsc_a_plugin_writing_below_the_root_leaves_a_pooled_compile_settled } from "./unplugin/native-plugins/transform/test_transformttsc_a_plugin_writing_below_the_root_leaves_a_pooled_compile_settled";
import { test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed } from "./unplugin/native-plugins/transform/test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed";
import { test_transformttsc_a_shared_session_serves_a_plugin_input_recreated_after_a_failed_compile } from "./unplugin/native-plugins/transform/test_transformttsc_a_shared_session_serves_a_plugin_input_recreated_after_a_failed_compile";
import { test_transformttsc_build_passes_retain_no_filesystem_watchers } from "./unplugin/native-plugins/transform/test_transformttsc_build_passes_retain_no_filesystem_watchers";
import { test_transformttsc_caches_one_compile_with_unproven_resolution_candidates } from "./unplugin/native-plugins/transform/test_transformttsc_caches_one_compile_with_unproven_resolution_candidates";
import { test_transformttsc_certifies_no_dependency_state_first_seen_after_its_compile } from "./unplugin/native-plugins/transform/test_transformttsc_certifies_no_dependency_state_first_seen_after_its_compile";
import { test_transformttsc_compile_leaves_the_event_loop_and_environment_free } from "./unplugin/native-plugins/transform/test_transformttsc_compile_leaves_the_event_loop_and_environment_free";
import { test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output } from "./unplugin/native-plugins/transform/test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output";
import { test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output } from "./unplugin/native-plugins/transform/test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output";
import { test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation } from "./unplugin/native-plugins/transform/test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation";
import { test_transformttsc_events_after_the_compile_do_not_fail_capture } from "./unplugin/native-plugins/transform/test_transformttsc_events_after_the_compile_do_not_fail_capture";
import { test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output } from "./unplugin/native-plugins/transform/test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output";
import { test_transformttsc_external_hardlink_write_invalidates_generation } from "./unplugin/native-plugins/transform/test_transformttsc_external_hardlink_write_invalidates_generation";
import { test_transformttsc_failed_generation_recovery_batch } from "./unplugin/native-plugins/transform/test_transformttsc_failed_generation_recovery_batch";
import { test_transformttsc_hands_a_fallback_record_or_refuses_a_watching_delivery } from "./unplugin/native-plugins/transform/test_transformttsc_hands_a_fallback_record_or_refuses_a_watching_delivery";
import { test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output } from "./unplugin/native-plugins/transform/test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output";
import { test_transformttsc_notified_absent_candidate_is_not_reprobed } from "./unplugin/native-plugins/transform/test_transformttsc_notified_absent_candidate_is_not_reprobed";
import { test_transformttsc_persistent_project_watcher_cardinality_is_bounded } from "./unplugin/native-plugins/transform/test_transformttsc_persistent_project_watcher_cardinality_is_bounded";
import { test_transformttsc_persistent_utility_config_dependencies_invalidate_the_generation } from "./unplugin/native-plugins/transform/test_transformttsc_persistent_utility_config_dependencies_invalidate_the_generation";
import { test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation } from "./unplugin/native-plugins/transform/test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation";
import { test_transformttsc_persistent_validation_proves_shared_inputs_once } from "./unplugin/native-plugins/transform/test_transformttsc_persistent_validation_proves_shared_inputs_once";
import { test_transformttsc_persistent_validation_uses_per_file_inputs } from "./unplugin/native-plugins/transform/test_transformttsc_persistent_validation_uses_per_file_inputs";
import { test_transformttsc_pooled_workers_adopt_a_compile_from_before_a_restart } from "./unplugin/native-plugins/transform/test_transformttsc_pooled_workers_adopt_a_compile_from_before_a_restart";
import { test_transformttsc_pooled_workers_recover_from_a_dead_compiler } from "./unplugin/native-plugins/transform/test_transformttsc_pooled_workers_recover_from_a_dead_compiler";
import { test_transformttsc_pooled_workers_refuse_a_publication_of_another_build_environment } from "./unplugin/native-plugins/transform/test_transformttsc_pooled_workers_refuse_a_publication_of_another_build_environment";
import { test_transformttsc_pooled_workers_refuse_a_publication_of_another_plugin_source } from "./unplugin/native-plugins/transform/test_transformttsc_pooled_workers_refuse_a_publication_of_another_plugin_source";
import { test_transformttsc_recompiles_after_its_plugin_source_is_edited } from "./unplugin/native-plugins/transform/test_transformttsc_recompiles_after_its_plugin_source_is_edited";
import { test_transformttsc_separated_stamp_re_earns_its_signature } from "./unplugin/native-plugins/transform/test_transformttsc_separated_stamp_re_earns_its_signature";
import { test_transformttsc_survives_high_darwin_descriptors } from "./unplugin/native-plugins/transform/test_transformttsc_survives_high_darwin_descriptors";
import { test_transformttsc_synchronous_membership_change_reaches_the_next_delivery } from "./unplugin/native-plugins/transform/test_transformttsc_synchronous_membership_change_reaches_the_next_delivery";
import { test_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation } from "./unplugin/native-plugins/transform/test_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation";
import { test_transformttsc_uses_filesystem_path_identity } from "./unplugin/native-plugins/transform/test_transformttsc_uses_filesystem_path_identity";
import { test_transformttsc_utility_config_proof_refuses_a_nearer_candidate_that_came_and_went } from "./unplugin/native-plugins/transform/test_transformttsc_utility_config_proof_refuses_a_nearer_candidate_that_came_and_went";
import { test_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir } from "./unplugin/native-plugins/transform/test_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir";
import { case_explicit_precompilation_overlaps_project_gates } from "./unplugin/scenes/case_explicit_precompilation_overlaps_project_gates";
import { case_unproven_plugin_source_is_rejected_after_native_preparation } from "./unplugin/scenes/case_unproven_plugin_source_is_rejected_after_native_preparation";
import { test_transform_session_store_outlives_its_process } from "./unplugin/transform/test_transform_session_store_outlives_its_process";

/**
 * Executes every scenario that has no consumer in another batch.
 *
 * #1603 moved most of these scenarios from `tests/test-ttsc` into this package,
 * and kept two former suite entries, without a batch that runs them, so from
 * 2026-10-07 until this batch existed no CI job executed them (#1731). Each one
 * prepares its own project, so this batch runs them one after another and
 * reports every failure by name. The scenario ownership check
 * (`assertScenarioOwnership`) fails CI when a scenario file is owned by no
 * batch, so a new or moved scenario cannot silently stop running again.
 *
 * The scenarios were written for a standalone project in the system temporary
 * directory. The suite's own temporary parent lies inside the checkout, where
 * the repository's `pnpm-workspace.yaml` becomes every fixture's workspace: the
 * default ttsc cache then resolves to the repository's own `node_modules`, and
 * `pnpm install` in a fixture installs the repository instead. So while they
 * run, `TEMP`, `TMP` and `TMPDIR` name a private directory under the parent the
 * run inherited, resolved to its physical path, which must lie outside the
 * checkout.
 *
 * 1. Allocate the private temporary parent outside the checkout.
 * 2. Run each listed scenario in order, awaiting the asynchronous ones.
 * 3. Report each failure under its scenario name, and the elapsed time of each.
 *
 * @evidence contracts/testing.md#behavioral-verification Each scenario keeps its own real launches and assertions; this batch only supplies execution.
 * @evidence contracts/testing.md#independent-expectations Expectations stay in the scenarios that own them.
 * @evidence contracts/testing.md#distinguishing-cases Every scenario runs and fails separately under its own name; one failure does not hide another.
 * @evidence contracts/testing.md#execution-ownership src/main.ts selects this batch, which owns exactly the listed scenarios; the ownership check proves no other scenario file is unowned.
 * @evidence contracts/e2e.md#necessary-boundary The scenarios were authored against real processes and installations; this entry adds no process of its own.
 * @evidence contracts/e2e.md#shared-execution The scenarios prepare private projects and share only the suite's Go object cache, as they did in their former package.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Scenarios run sequentially, so no two mutate shared state at once. Their temporary parent is the physical directory outside the checkout, as path.relative decides even across Windows volumes, so no fixture resolves the repository as its workspace or writes into the repository's own cache; the previous temporary variables are restored afterwards.
 * @evidence contracts/e2e.md#preserved-coverage Restores execution of every scenario #1603 left without a consumer.
 */
export async function test_e2e_scenarios_batch(): Promise<void> {
  // Physical, as the suite's own parent is: macOS names its temporary directory
  // through /var, a link to /private/var, and the scenarios compare the paths
  // they allocate with the physical ones processes report.
  const inherited = fs.realpathSync.native(
    process.env.E2E_INHERITED_TMPDIR ?? os.tmpdir(),
  );
  const relative = path.relative(TestProject.WORKSPACE_ROOT, inherited);
  if (
    !path.isAbsolute(relative) &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep)
  )
    throw new Error(
      `The scenarios need a temporary parent outside the checkout: ${inherited}`,
    );
  const parent = TestProject.tmpdir("ttsc-e2e-scenarios-", inherited);
  const names = ["TEMP", "TMP", "TMPDIR"] as const;
  const previous = names.map((name) => process.env[name]);
  for (const name of names) process.env[name] = parent;
  const failures: unknown[] = [];
  try {
    for (const [name, run] of SCENARIOS) {
      const started = Date.now();
      try {
        await run();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
      process.stdout.write(`scenario ${name}: ${Date.now() - started} ms\n`);
    }
  } finally {
    names.forEach((name, index) => {
      const value = previous[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      `${failures.length} of ${SCENARIOS.length} scenarios failed`,
    );
}

/** The scenarios this batch owns, by exported name. */
const SCENARIOS: readonly (readonly [string, () => unknown])[] = [
  [
    "case_watch_topology_worker_owns_responsive_ordered_lifetimes",
    case_watch_topology_worker_owns_responsive_ordered_lifetimes,
  ],
  [
    "case_explicit_precompilation_overlaps_project_gates",
    case_explicit_precompilation_overlaps_project_gates,
  ],
  [
    "case_unproven_plugin_source_is_rejected_after_native_preparation",
    case_unproven_plugin_source_is_rejected_after_native_preparation,
  ],
  ["test_e2e_compiler_stub", test_e2e_compiler_stub],
  ["test_e2e_evidence", test_e2e_evidence],
  ["test_e2e_installation", test_e2e_installation],
  [
    "test_residenttransformprocess_lifecycle",
    test_residenttransformprocess_lifecycle,
  ],
  [
    "test_residenttransformprocess_request_bounds",
    test_residenttransformprocess_request_bounds,
  ],
  [
    "test_testproject_exit_removes_joined_temporary_roots",
    test_testproject_exit_removes_joined_temporary_roots,
  ],
  [
    "test_testproject_exit_retains_owned_roots_with_unknown_descendants",
    test_testproject_exit_retains_owned_roots_with_unknown_descendants,
  ],
  [
    "test_ttsccompiler_source_plugin_discovery_shares_one_project",
    test_ttsccompiler_source_plugin_discovery_shares_one_project,
  ],
  [
    "test_compiler_consumer_local_native_compiler_receives_the_launcher_contract",
    test_compiler_consumer_local_native_compiler_receives_the_launcher_contract,
  ],
  [
    "test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries",
    test_compiler_shared_program_preserves_emit_and_diagnostic_boundaries,
  ],
  [
    "test_consumer_compiler_preserves_external_emit_provenance_process_control",
    test_consumer_compiler_preserves_external_emit_provenance_process_control,
  ],
  [
    "test_ttsc_watch_rebuilds_for_a_plugin_module_outside_its_package",
    test_ttsc_watch_rebuilds_for_a_plugin_module_outside_its_package,
  ],
  [
    "test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source",
    test_ttsc_watch_rebuilds_for_a_selected_go_plugin_source,
  ],
  [
    "test_plugin_corpus_auto_discovered_lint_prefer_const_tracks_lexical_bindings",
    test_plugin_corpus_auto_discovered_lint_prefer_const_tracks_lexical_bindings,
  ],
  [
    "test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists",
    test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists,
  ],
  [
    "test_plugin_corpus_check_watch_fallback_keeps_forwarded_compiler_flags",
    test_plugin_corpus_check_watch_fallback_keeps_forwarded_compiler_flags,
  ],
  [
    "test_plugin_corpus_check_watch_invalidates_json_input_membership_without_restarting_resident",
    test_plugin_corpus_check_watch_invalidates_json_input_membership_without_restarting_resident,
  ],
  [
    "test_plugin_corpus_check_watch_preserves_duplicate_resident_entries",
    test_plugin_corpus_check_watch_preserves_duplicate_resident_entries,
  ],
  [
    "test_plugin_corpus_check_watch_rebuilds_a_plugin_binary_the_cache_removed",
    test_plugin_corpus_check_watch_rebuilds_a_plugin_binary_the_cache_removed,
  ],
  [
    "test_plugin_corpus_check_watch_records_use_of_its_plugin_binary",
    test_plugin_corpus_check_watch_records_use_of_its_plugin_binary,
  ],
  [
    "test_plugin_corpus_check_watch_reloads_changed_lint_config_contributors",
    test_plugin_corpus_check_watch_reloads_changed_lint_config_contributors,
  ],
  [
    "test_plugin_corpus_check_watch_reuses_resident_program",
    test_plugin_corpus_check_watch_reuses_resident_program,
  ],
  [
    "test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed",
    test_plugin_corpus_concurrent_ttsc_invocations_on_a_cold_cache_both_succeed,
  ],
  [
    "test_plugin_corpus_missing_go_toolchain_points_users_at_the_install_hint",
    test_plugin_corpus_missing_go_toolchain_points_users_at_the_install_hint,
  ],
  [
    "test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform",
    test_plugin_corpus_package_relative_auto_plugins_do_not_collide_by_raw_transform,
  ],
  [
    "test_plugin_corpus_package_ttsc_plugin_auto_discovers_ttsc_lint_config_files",
    test_plugin_corpus_package_ttsc_plugin_auto_discovers_ttsc_lint_config_files,
  ],
  [
    "test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output",
    test_plugin_corpus_prepare_builds_source_plugins_without_emitting_project_output,
  ],
  [
    "test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx",
    test_plugin_corpus_prepare_loads_typescript_lint_config_without_path_ttsx,
  ],
  [
    "test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option",
    test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option,
  ],
  [
    "test_plugin_corpus_ttsx_check_plugin_pass_leaves_build_info_untouched",
    test_plugin_corpus_ttsx_check_plugin_pass_leaves_build_info_untouched,
  ],
  [
    "test_plugin_corpus_ttsx_nested_project_reuses_the_prepared_workspace_cache",
    test_plugin_corpus_ttsx_nested_project_reuses_the_prepared_workspace_cache,
  ],
  [
    "test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end",
    test_plugin_corpus_ttsx_register_executes_source_plugin_output_end_to_end,
  ],
  [
    "test_plugin_corpus_ttsx_runs_a_host_that_declares_no_emit_provenance",
    test_plugin_corpus_ttsx_runs_a_host_that_declares_no_emit_provenance,
  ],
  [
    "test_plugin_corpus_watch_rebuilds_for_declared_markdown_and_swagger_inputs",
    test_plugin_corpus_watch_rebuilds_for_declared_markdown_and_swagger_inputs,
  ],
  [
    "test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry",
    test_plugin_missing_ttsc_export_condition_falls_back_to_default_entry,
  ],
  [
    "test_project_rule_lifecycle_surfaces_through_package_discovery_cli_api_and_watch",
    test_project_rule_lifecycle_surfaces_through_package_discovery_cli_api_and_watch,
  ],
  [
    "test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr",
    test_plugin_corpus_source_plugin_build_failure_reports_go_compiler_stderr,
  ],
  [
    "test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache",
    test_plugin_corpus_source_plugin_default_cache_is_workspace_local_content_cache,
  ],
  [
    "test_plugin_corpus_ttsc_lint_applies_forwarded_strict_flag",
    test_plugin_corpus_ttsc_lint_applies_forwarded_strict_flag,
  ],
  [
    "test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics",
    test_plugin_corpus_ttsc_lint_failure_does_not_duplicate_typescript_diagnostics,
  ],
  [
    "test_plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check",
    test_plugin_corpus_ttsc_lint_fix_rewrites_source_before_final_check,
  ],
  [
    "test_plugin_corpus_ttsc_lint_format_subcommand_rewrites_source",
    test_plugin_corpus_ttsc_lint_format_subcommand_rewrites_source,
  ],
  [
    "test_plugin_corpus_ttsc_lint_no_emit_skips_redundant_tsgo_check",
    test_plugin_corpus_ttsc_lint_no_emit_skips_redundant_tsgo_check,
  ],
  [
    "test_plugin_corpus_emit_watch_reuses_plugin_selection_until_config_changes",
    test_plugin_corpus_emit_watch_reuses_plugin_selection_until_config_changes,
  ],
  [
    "test_plugin_corpus_ttsx_check_host_accepts_sibling_sources_without_rootdir",
    test_plugin_corpus_ttsx_check_host_accepts_sibling_sources_without_rootdir,
  ],
  [
    "test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache",
    test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache,
  ],
  [
    "test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path",
    test_plugin_corpus_ttsc_lint_surfaces_rule_violations_through_the_normal_failure_path,
  ],
  [
    "test_native_transformer_project_go_sidecar_handles_project_build",
    test_native_transformer_project_go_sidecar_handles_project_build,
  ],
  [
    "test_transform_apis_resolve_relative_node_binary_from_project_root",
    test_transform_apis_resolve_relative_node_binary_from_project_root,
  ],
  [
    "test_ttscservice_rejects_when_the_project_does_not_compile",
    test_ttscservice_rejects_when_the_project_does_not_compile,
  ],
  [
    "test_ttscservice_transforms_a_file_through_the_resident_host",
    test_ttscservice_transforms_a_file_through_the_resident_host,
  ],
  [
    "test_ttscservice_answers_a_file_named_through_a_linked_project_root",
    test_ttscservice_answers_a_file_named_through_a_linked_project_root,
  ],
  [
    "test_buildsourceplugin_reclaims_dead_legacy_plugin_lock",
    test_buildsourceplugin_reclaims_dead_legacy_plugin_lock,
  ],
  [
    "test_buildsourceplugin_waiter_recovers_when_holder_fails_and_releases",
    test_buildsourceplugin_waiter_recovers_when_holder_fails_and_releases,
  ],
  [
    "test_buildsourceplugin_waiter_reuses_binary_published_during_release",
    test_buildsourceplugin_waiter_reuses_binary_published_during_release,
  ],
  [
    "test_gobuildcache_prunes_lru_objects_outside_active_build_leases",
    test_gobuildcache_prunes_lru_objects_outside_active_build_leases,
  ],
  [
    "test_package_artifact_gc_preserves_active_native_builds",
    test_package_artifact_gc_preserves_active_native_builds,
  ],
  [
    "test_source_package_artifacts_selects_only_matching_admitted_packs",
    test_source_package_artifacts_selects_only_matching_admitted_packs,
  ],
  [
    "test_source_package_artifact_publisher_seals_real_builder_actions",
    test_source_package_artifact_publisher_seals_real_builder_actions,
  ],
  [
    "test_ttsc_reclaims_dead_legacy_source_plugin_lock_e2e",
    test_ttsc_reclaims_dead_legacy_source_plugin_lock_e2e,
  ],
  [
    "test_ttsc_lint_config_evaluator_keeps_bootstrap_out_of_the_parent_descriptor_channel",
    test_ttsc_lint_config_evaluator_keeps_bootstrap_out_of_the_parent_descriptor_channel,
  ],
  [
    "test_ttsc_lint_descriptor_tracks_external_discovery_candidates",
    test_ttsc_lint_descriptor_tracks_external_discovery_candidates,
  ],
  [
    "test_ttsc_descriptor_input_report_preserves_order_and_failure",
    test_ttsc_descriptor_input_report_preserves_order_and_failure,
  ],
  [
    "test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build",
    test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build,
  ],
  [
    "test_ttsc_utility_plugins_paths_side_loads_into_driver_host",
    test_ttsc_utility_plugins_paths_side_loads_into_driver_host,
  ],
  [
    "test_loadprojectplugins_reports_the_directories_its_plugin_builds_key_on",
    test_loadprojectplugins_reports_the_directories_its_plugin_builds_key_on,
  ],
  [
    "test_loadprojectplugins_tracks_bun_esm_descriptor_dependencies",
    test_loadprojectplugins_tracks_bun_esm_descriptor_dependencies,
  ],
  [
    "test_plugin_descriptor_failures_propagate_and_cleanup_ttsx_temp",
    test_plugin_descriptor_failures_propagate_and_cleanup_ttsx_temp,
  ],
  [
    "test_resolution_recorder_observes_require_resolve_through_the_supported_hooks",
    test_resolution_recorder_observes_require_resolve_through_the_supported_hooks,
  ],
  [
    "test_spawn_sync_resilient_broker_preserves_process_contract",
    test_spawn_sync_resilient_broker_preserves_process_contract,
  ],
  [
    "test_ttscserver_exits_on_exit_while_stdin_stays_open",
    test_ttscserver_exits_on_exit_while_stdin_stays_open,
  ],
  [
    "test_ttscserver_exits_on_stdin_close",
    test_ttscserver_exits_on_stdin_close,
  ],
  [
    "test_ttscserver_initializes_and_shuts_down",
    test_ttscserver_initializes_and_shuts_down,
  ],
  [
    "test_ttscserver_launcher_resolves_platform_binary_without_env_override",
    test_ttscserver_launcher_resolves_platform_binary_without_env_override,
  ],
  [
    "test_ttscserver_session_reports_its_own_failure_before_its_shutdowns",
    test_ttscserver_session_reports_its_own_failure_before_its_shutdowns,
  ],
  [
    "test_vscode_install_script_installs_default_bundled_vsix",
    test_vscode_install_script_installs_default_bundled_vsix,
  ],
  [
    "test_ttsx_coverage_maps_preserve_entry_and_dependency_sources_in_shared_hosts",
    test_ttsx_coverage_maps_preserve_entry_and_dependency_sources_in_shared_hosts,
  ],
  [
    "test_ttsx_forks_a_child_whose_entry_path_is_javascript",
    test_ttsx_forks_a_child_whose_entry_path_is_javascript,
  ],
  [
    "test_ttsx_gives_a_javascript_commonjs_module_an_import_reaches_nodes_require",
    test_ttsx_gives_a_javascript_commonjs_module_an_import_reaches_nodes_require,
  ],
  [
    "test_ttsx_keeps_a_commonjs_entry_the_main_module_under_an_import_preload",
    test_ttsx_keeps_a_commonjs_entry_the_main_module_under_an_import_preload,
  ],
  [
    "test_ttsx_missing_import_branches_preserve_native_errors_in_one_host",
    test_ttsx_missing_import_branches_preserve_native_errors_in_one_host,
  ],
  [
    "test_ttsx_preloads_every_require_spelling_before_the_entry",
    test_ttsx_preloads_every_require_spelling_before_the_entry,
  ],
  [
    "test_ttsx_propagates_the_source_loader_to_a_child_process",
    test_ttsx_propagates_the_source_loader_to_a_child_process,
  ],
  [
    "test_ttsx_register_runs_checked_commonjs_and_esm_node_entries",
    test_ttsx_register_runs_checked_commonjs_and_esm_node_entries,
  ],
  [
    "test_ttsx_runs_a_javascript_entry_with_its_own_argv",
    test_ttsx_runs_a_javascript_entry_with_its_own_argv,
  ],
  [
    "test_ttsx_runs_the_entry_as_the_main_module",
    test_ttsx_runs_the_entry_as_the_main_module,
  ],
  [
    "test_ttsx_stack_maps_preserve_entry_and_dependency_positions_in_shared_hosts",
    test_ttsx_stack_maps_preserve_entry_and_dependency_positions_in_shared_hosts,
  ],
  [
    "test_commonjs_runtime_corpus_preserves_source_ownership_across_project_profiles",
    test_commonjs_runtime_corpus_preserves_source_ownership_across_project_profiles,
  ],
  [
    "test_external_response_provenance_preserves_the_actual_producer",
    test_external_response_provenance_preserves_the_actual_producer,
  ],
  [
    "test_runner_corpus_invalid_tsconfig_prevents_entry_execution",
    test_runner_corpus_invalid_tsconfig_prevents_entry_execution,
  ],
  [
    "test_runtime_owner_preload_claims_before_program_and_rejects_a_missing_run",
    test_runtime_owner_preload_claims_before_program_and_rejects_a_missing_run,
  ],
  [
    "test_ttsc_clean_removes_the_runtime_directories_no_run_owns",
    test_ttsc_clean_removes_the_runtime_directories_no_run_owns,
  ],
  [
    "test_ttsx_and_register_remove_a_run_directory_whose_owners_are_gone",
    test_ttsx_and_register_remove_a_run_directory_whose_owners_are_gone,
  ],
  [
    "test_ttsx_builds_a_failing_project_once_for_every_file_it_owns",
    test_ttsx_builds_a_failing_project_once_for_every_file_it_owns,
  ],
  [
    "test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it",
    test_ttsx_checks_a_typescript_file_the_program_generates_before_running_it,
  ],
  [
    "test_ttsx_classifies_a_symlinked_entry_from_the_target_package_type",
    test_ttsx_classifies_a_symlinked_entry_from_the_target_package_type,
  ],
  [
    "test_ttsx_classifies_the_entry_by_a_forwarded_module_flag",
    test_ttsx_classifies_the_entry_by_a_forwarded_module_flag,
  ],
  [
    "test_ttsx_compiles_and_checks_a_typescript_preload_outside_include",
    test_ttsx_compiles_and_checks_a_typescript_preload_outside_include,
  ],
  [
    "test_ttsx_compiles_the_whole_project_when_rootdir_is_a_symlink",
    test_ttsx_compiles_the_whole_project_when_rootdir_is_a_symlink,
  ],
  [
    "test_ttsx_decorator_orphan_reexports_honor_the_owning_project",
    test_ttsx_decorator_orphan_reexports_honor_the_owning_project,
  ],
  [
    "test_ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map",
    test_ttsx_dependency_own_type_diagnostics_do_not_fail_the_run_while_inlining_its_map,
  ],
  [
    "test_ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate",
    test_ttsx_emits_an_installed_package_root_its_own_build_omits_without_a_type_gate,
  ],
  [
    "test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error",
    test_ttsx_emits_an_installed_package_root_whose_config_sets_no_emit_on_error,
  ],
  [
    "test_ttsx_executes_standard_decorators_in_source_dependencies",
    test_ttsx_executes_standard_decorators_in_source_dependencies,
  ],
  [
    "test_ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package",
    test_ttsx_fails_at_the_compile_gate_on_a_type_error_in_an_imported_workspace_package,
  ],
  [
    "test_ttsx_failure_cleanup_pins_a_linked_run_index",
    test_ttsx_failure_cleanup_pins_a_linked_run_index,
  ],
  [
    "test_ttsx_failure_cleanup_retains_physical_cache_generation",
    test_ttsx_failure_cleanup_retains_physical_cache_generation,
  ],
  [
    "test_ttsx_follows_directory_references_nested_solutions_and_cycles",
    test_ttsx_follows_directory_references_nested_solutions_and_cycles,
  ],
  [
    "test_ttsx_forwards_an_unknown_flag_to_tsgo",
    test_ttsx_forwards_an_unknown_flag_to_tsgo,
  ],
  [
    "test_ttsx_keeps_a_run_directory_another_run_named_by_the_same_pid",
    test_ttsx_keeps_a_run_directory_another_run_named_by_the_same_pid,
  ],
  [
    "test_ttsx_lets_a_javascript_entry_under_an_import_preload_require_typescript",
    test_ttsx_lets_a_javascript_entry_under_an_import_preload_require_typescript,
  ],
  [
    "test_ttsx_manifest_less_child_runs_the_edited_source_on_the_next_run",
    test_ttsx_manifest_less_child_runs_the_edited_source_on_the_next_run,
  ],
  [
    "test_ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root",
    test_ttsx_nested_tsconfig_keeps_the_existing_workspace_cache_root,
  ],
  [
    "test_ttsx_no_plugins_skips_plugin_loading",
    test_ttsx_no_plugins_skips_plugin_loading,
  ],
  [
    "test_ttsx_preserves_an_empty_nested_node_modules_cache_boundary",
    test_ttsx_preserves_an_empty_nested_node_modules_cache_boundary,
  ],
  [
    "test_ttsx_preserves_custom_node_builtin_remaps",
    test_ttsx_preserves_custom_node_builtin_remaps,
  ],
  [
    "test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink",
    test_ttsx_publishes_a_physical_root_for_a_dependency_whose_rootdir_is_a_symlink,
  ],
  [
    "test_ttsx_rebuilds_a_root_the_program_rewrites_between_child_processes",
    test_ttsx_rebuilds_a_root_the_program_rewrites_between_child_processes,
  ],
  [
    "test_ttsx_reclaims_the_directory_of_a_force_terminated_run",
    test_ttsx_reclaims_the_directory_of_a_force_terminated_run,
  ],
  [
    "test_ttsx_register_executes_excluded_standard_decorators",
    test_ttsx_register_executes_excluded_standard_decorators,
  ],
  [
    "test_ttsx_register_runs_multiple_out_of_include_mocha_roots",
    test_ttsx_register_runs_multiple_out_of_include_mocha_roots,
  ],
  [
    "test_ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes",
    test_ttsx_reports_a_type_error_in_an_entry_the_project_include_excludes,
  ],
  [
    "test_ttsx_resolves_config_dir_paths_for_an_installed_package_root",
    test_ttsx_resolves_config_dir_paths_for_an_installed_package_root,
  ],
  [
    "test_ttsx_runs_a_generated_file_with_the_referenced_project_that_owns_it",
    test_ttsx_runs_a_generated_file_with_the_referenced_project_that_owns_it,
  ],
  [
    "test_ttsx_runs_a_source_file_the_entry_generates_at_runtime",
    test_ttsx_runs_a_source_file_the_entry_generates_at_runtime,
  ],
  [
    "test_ttsx_runs_an_entry_that_is_itself_a_symlink",
    test_ttsx_runs_an_entry_that_is_itself_a_symlink,
  ],
  [
    "test_ttsx_runs_an_entry_with_the_referenced_project_that_owns_it",
    test_ttsx_runs_an_entry_with_the_referenced_project_that_owns_it,
  ],
  [
    "test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options",
    test_ttsx_runs_an_excluded_entry_under_the_project_compiler_options,
  ],
  [
    "test_ttsx_runs_through_a_linked_run_index",
    test_ttsx_runs_through_a_linked_run_index,
  ],
  [
    "test_ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory",
    test_ttsx_serves_a_files_listed_source_outside_the_tsconfig_directory,
  ],
  [
    "test_ttsx_serves_a_source_whose_twin_has_another_typescript_extension",
    test_ttsx_serves_a_source_whose_twin_has_another_typescript_extension,
  ],
  [
    "test_ttsx_shares_one_dependency_build_across_concurrent_processes",
    test_ttsx_shares_one_dependency_build_across_concurrent_processes,
  ],
  [
    "test_ttsx_standard_decorators_in_orphans_do_not_cache_imported_values",
    test_ttsx_standard_decorators_in_orphans_do_not_cache_imported_values,
  ],
  [
    "test_ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered",
    test_ttsx_stops_on_a_type_error_in_a_required_source_no_checked_build_covered,
  ],
  [
    "test_ttsx_ttsc_cache_dir_relocates_the_runtime_cache",
    test_ttsx_ttsc_cache_dir_relocates_the_runtime_cache,
  ],
  [
    "test_ttsx_virtual_layout_mirrors_a_file_symlink_project_entry",
    test_ttsx_virtual_layout_mirrors_a_file_symlink_project_entry,
  ],
  [
    "test_watch_topology_keeps_case_sensitive_inputs_outside_case_distinct_outputs",
    test_watch_topology_keeps_case_sensitive_inputs_outside_case_distinct_outputs,
  ],
  [
    "test_watch_topology_keeps_compiler_inputs_when_outdir_contains_project",
    test_watch_topology_keeps_compiler_inputs_when_outdir_contains_project,
  ],
  [
    "test_watch_topology_preserves_authoritative_inputs_and_json_outputs",
    test_watch_topology_preserves_authoritative_inputs_and_json_outputs,
  ],
  [
    "test_watch_topology_preserves_case_sensitive_project_inputs",
    test_watch_topology_preserves_case_sensitive_project_inputs,
  ],
  [
    "test_watch_topology_registers_physical_watch_paths",
    test_watch_topology_registers_physical_watch_paths,
  ],
  [
    "test_watch_topology_reports_deleted_config_and_recreation",
    test_watch_topology_reports_deleted_config_and_recreation,
  ],
  [
    "test_watch_topology_tracks_external_inputs_across_project_references",
    test_watch_topology_tracks_external_inputs_across_project_references,
  ],
  [
    "test_watch_topology_watches_reload_symlink_targets",
    test_watch_topology_watches_reload_symlink_targets,
  ],
  [
    "test_bun_adapter_forwards_bundler_build_start",
    test_bun_adapter_forwards_bundler_build_start,
  ],
  [
    "test_bun_native_host_owns_build_and_runtime_sessions",
    test_bun_native_host_owns_build_and_runtime_sessions,
  ],
  [
    "test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order",
    test_bun_register_explicit_options_are_not_shadowed_in_same_runtime_order,
  ],
  [
    "test_bun_register_preload_only_registers_a_single_default_plugin",
    test_bun_register_preload_only_registers_a_single_default_plugin,
  ],
  [
    "test_bun_runtime_does_not_rehash_the_project_per_module",
    test_bun_runtime_does_not_rehash_the_project_per_module,
  ],
  [
    "test_packaged_entrypoints_publish_module_faithful_declarations",
    test_packaged_entrypoints_publish_module_faithful_declarations,
  ],
  [
    "test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge",
    test_rollup_build_given_a_cache_rebuilds_through_a_type_only_edge,
  ],
  [
    "test_rollup_disposes_at_the_right_boundary",
    test_rollup_disposes_at_the_right_boundary,
  ],
  [
    "test_turbopack_loader_keeps_its_worker_through_a_failed_compile",
    test_turbopack_loader_keeps_its_worker_through_a_failed_compile,
  ],
  [
    "test_turbopack_loader_passes_through_an_out_of_program_module",
    test_turbopack_loader_passes_through_an_out_of_program_module,
  ],
  [
    "test_turbopack_loader_proves_its_own_records_under_a_session",
    test_turbopack_loader_proves_its_own_records_under_a_session,
  ],
  [
    "test_turbopack_loader_signals_a_change_before_turbopacks_baseline",
    test_turbopack_loader_signals_a_change_before_turbopacks_baseline,
  ],
  [
    "test_vite_build_serves_wrapper_queries_from_the_host",
    test_vite_build_serves_wrapper_queries_from_the_host,
  ],
  [
    "test_vite_serve_first_request_survives_missing_resolution_candidates",
    test_vite_serve_first_request_survives_missing_resolution_candidates,
  ],
  [
    "test_vite_serve_ignores_an_unrelated_missing_file_creation",
    test_vite_serve_ignores_an_unrelated_missing_file_creation,
  ],
  [
    "test_vite_serve_reports_errors_at_the_authored_line",
    test_vite_serve_reports_errors_at_the_authored_line,
  ],
  [
    "test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears",
    test_vite_serve_retransforms_the_importer_when_a_superseding_candidate_appears,
  ],
  [
    "test_vite_serve_survives_missing_candidates_after_a_server_restart",
    test_vite_serve_survives_missing_candidates_after_a_server_restart,
  ],
  [
    "test_webpack_filesystem_cache_control_serves_stale_without_a_graph",
    test_webpack_filesystem_cache_control_serves_stale_without_a_graph,
  ],
  [
    "test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge",
    test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge,
  ],
  [
    "test_webpack_watch_rebuilds_through_a_type_only_edge",
    test_webpack_watch_rebuilds_through_a_type_only_edge,
  ],
  [
    "test_webpack_watch_reuses_the_generation_across_rebuilds",
    test_webpack_watch_reuses_the_generation_across_rebuilds,
  ],
  [
    "test_real_native_envelope_shared_corpus",
    test_real_native_envelope_shared_corpus,
  ],
  [
    "test_directory_observer_watches_only_admitted_directories",
    test_directory_observer_watches_only_admitted_directories,
  ],
  [
    "test_host_input_tracker_real_backends_agree",
    test_host_input_tracker_real_backends_agree,
  ],
  [
    "test_linux_trackers_watch_no_package_tree",
    test_linux_trackers_watch_no_package_tree,
  ],
  [
    "test_linux_watch_helper_keeps_every_watch_honest",
    test_linux_watch_helper_keeps_every_watch_honest,
  ],
  [
    "test_transformttsc_a_failed_compile_that_raced_its_repair_is_compiled_again",
    test_transformttsc_a_failed_compile_that_raced_its_repair_is_compiled_again,
  ],
  [
    "test_transformttsc_a_linked_project_keeps_its_notification_coverage",
    test_transformttsc_a_linked_project_keeps_its_notification_coverage,
  ],
  [
    "test_transformttsc_a_new_process_witnesses_the_dependencies_its_record_names",
    test_transformttsc_a_new_process_witnesses_the_dependencies_its_record_names,
  ],
  [
    "test_transformttsc_a_plugin_writing_below_the_root_leaves_a_pooled_compile_settled",
    test_transformttsc_a_plugin_writing_below_the_root_leaves_a_pooled_compile_settled,
  ],
  [
    "test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed",
    test_transformttsc_a_pooled_session_does_not_publish_a_compile_whose_graph_proof_failed,
  ],
  [
    "test_transformttsc_a_shared_session_serves_a_plugin_input_recreated_after_a_failed_compile",
    test_transformttsc_a_shared_session_serves_a_plugin_input_recreated_after_a_failed_compile,
  ],
  [
    "test_transformttsc_build_passes_retain_no_filesystem_watchers",
    test_transformttsc_build_passes_retain_no_filesystem_watchers,
  ],
  [
    "test_transformttsc_caches_one_compile_with_unproven_resolution_candidates",
    test_transformttsc_caches_one_compile_with_unproven_resolution_candidates,
  ],
  [
    "test_transformttsc_certifies_no_dependency_state_first_seen_after_its_compile",
    test_transformttsc_certifies_no_dependency_state_first_seen_after_its_compile,
  ],
  [
    "test_transformttsc_compile_leaves_the_event_loop_and_environment_free",
    test_transformttsc_compile_leaves_the_event_loop_and_environment_free,
  ],
  [
    "test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output",
    test_transformttsc_compile_snapshot_aba_race_cannot_authorize_stale_output,
  ],
  [
    "test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output",
    test_transformttsc_compile_snapshot_race_cannot_authorize_stale_output,
  ],
  [
    "test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation",
    test_transformttsc_descriptor_input_race_cannot_authorize_stale_generation,
  ],
  [
    "test_transformttsc_events_after_the_compile_do_not_fail_capture",
    test_transformttsc_events_after_the_compile_do_not_fail_capture,
  ],
  [
    "test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output",
    test_transformttsc_external_compile_snapshot_aba_race_cannot_authorize_stale_output,
  ],
  [
    "test_transformttsc_external_hardlink_write_invalidates_generation",
    test_transformttsc_external_hardlink_write_invalidates_generation,
  ],
  [
    "test_transformttsc_failed_generation_recovery_batch",
    test_transformttsc_failed_generation_recovery_batch,
  ],
  [
    "test_transformttsc_hands_a_fallback_record_or_refuses_a_watching_delivery",
    test_transformttsc_hands_a_fallback_record_or_refuses_a_watching_delivery,
  ],
  [
    "test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output",
    test_transformttsc_independent_graph_leaf_compile_snapshot_aba_race_cannot_authorize_stale_output,
  ],
  [
    "test_transformttsc_notified_absent_candidate_is_not_reprobed",
    test_transformttsc_notified_absent_candidate_is_not_reprobed,
  ],
  [
    "test_transformttsc_persistent_project_watcher_cardinality_is_bounded",
    test_transformttsc_persistent_project_watcher_cardinality_is_bounded,
  ],
  [
    "test_transformttsc_persistent_utility_config_dependencies_invalidate_the_generation",
    test_transformttsc_persistent_utility_config_dependencies_invalidate_the_generation,
  ],
  [
    "test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation",
    test_transformttsc_persistent_utility_config_link_retarget_invalidates_generation,
  ],
  [
    "test_transformttsc_persistent_validation_proves_shared_inputs_once",
    test_transformttsc_persistent_validation_proves_shared_inputs_once,
  ],
  [
    "test_transformttsc_persistent_validation_uses_per_file_inputs",
    test_transformttsc_persistent_validation_uses_per_file_inputs,
  ],
  [
    "test_transformttsc_pooled_workers_adopt_a_compile_from_before_a_restart",
    test_transformttsc_pooled_workers_adopt_a_compile_from_before_a_restart,
  ],
  [
    "test_transformttsc_pooled_workers_recover_from_a_dead_compiler",
    test_transformttsc_pooled_workers_recover_from_a_dead_compiler,
  ],
  [
    "test_transformttsc_pooled_workers_refuse_a_publication_of_another_build_environment",
    test_transformttsc_pooled_workers_refuse_a_publication_of_another_build_environment,
  ],
  [
    "test_transformttsc_pooled_workers_refuse_a_publication_of_another_plugin_source",
    test_transformttsc_pooled_workers_refuse_a_publication_of_another_plugin_source,
  ],
  [
    "test_transformttsc_recompiles_after_its_plugin_source_is_edited",
    test_transformttsc_recompiles_after_its_plugin_source_is_edited,
  ],
  [
    "test_transformttsc_separated_stamp_re_earns_its_signature",
    test_transformttsc_separated_stamp_re_earns_its_signature,
  ],
  [
    "test_transformttsc_survives_high_darwin_descriptors",
    test_transformttsc_survives_high_darwin_descriptors,
  ],
  [
    "test_transformttsc_synchronous_membership_change_reaches_the_next_delivery",
    test_transformttsc_synchronous_membership_change_reaches_the_next_delivery,
  ],
  [
    "test_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation",
    test_transformttsc_unnotified_utility_config_link_retarget_invalidates_generation,
  ],
  [
    "test_transformttsc_uses_filesystem_path_identity",
    test_transformttsc_uses_filesystem_path_identity,
  ],
  [
    "test_transformttsc_utility_config_proof_refuses_a_nearer_candidate_that_came_and_went",
    test_transformttsc_utility_config_proof_refuses_a_nearer_candidate_that_came_and_went,
  ],
  [
    "test_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir",
    test_ttsc_undeclared_run_scrubs_inherited_plugin_config_dir,
  ],
  [
    "test_transform_session_store_outlives_its_process",
    test_transform_session_store_outlives_its_process,
  ],
];
