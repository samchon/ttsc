import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

TestExecutor.main({
  location: path.join(process.cwd(), "src", "features"),
  // Balancing hints for `--shard`: the go-binary-building scenarios (native
  // plugin + source-plugin compiles) that dominate wall time, so a sharded CI
  // run spreads them evenly instead of stacking cold builds on one lane.
  // Approximate milliseconds from a profiling run; refresh when the ordering
  // drifts. Every unlisted test is cheap and spread by a name hash.
  weights: {
    test_ttsc_go_package_tests_pass: 160000,
    test_ttscservice_transforms_a_file_through_the_resident_host: 144000,
    test_ttscservice_rejects_when_the_project_does_not_compile: 143000,
    test_ttscservice_reflects_a_file_update_through_the_resident_host: 141000,
    test_ttsc_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build: 139000,
    test_ttsc_utility_plugins_shared_transform_host_works_when_paths_is_first: 115000,
    test_ttsx_builds_a_dependency_with_its_own_transform_plugin: 113000,
    test_ttsccompiler_can_disable_project_plugin_loading: 113000,
    test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache: 113000,
    test_plugin_corpus_auto_discovered_ttsc_lint_fails_when_no_config_file_exists: 112000,
    test_plugin_corpus_driver_emit_transform_preserves_declaration_outputs: 110000,
    test_plugin_corpus_source_plugin_walks_ast_uses_checker_to_enumerate_interface_properties: 100000,
    test_plugin_corpus_source_plugin_bootstraps_a_program_and_checker_against_the_consumer_tsconfig: 99000,
    test_plugin_corpus_source_plugin_can_import_tsgo_shim_modules_via_go_work_overlay: 52000,
    test_ttsc_utility_plugins_forced_emit_confines_output_to_outdir: 22000,
    test_ttsc_utility_plugins_paths_side_loads_into_driver_host: 14000,
  },
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
