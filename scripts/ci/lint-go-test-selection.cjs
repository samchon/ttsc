const fs = require("node:fs");
const path = require("node:path");

const { walkForGoFiles } = require("./go-test-overlay.cjs");

// Rule, formatter, contributor, parser and command semantics call Go functions.
// Actual child processes and native link/permission boundaries stay in e2e.
const UNIT_DIRECTORIES = new Set([
  "engine",
  "plugin",
  "format",
  "printer",
  "registry",
  "rules",
  "shared",
  "shim",
]);

// These cases execute Node or validate command behavior through linked files,
// so they retain their process or filesystem boundary.
const PROCESS_TESTS = new Set([
  "format_prettier_conformance_test.go",
  "format_sort_imports_preserves_binding_import_evaluation_order_test.go",
  "await_thenable_suggestion_preserves_microtask_boundary_test.go",
  "command_check_loads_no_restricted_types_options_from_typescript_config_test.go",
  "lsp_format_buffer_real_binary_e2e_test.go",
  "resident_rules_reuse_executable_config_across_real_and_linked_dependencies_test.go",
  "resident_rule_cache_respects_config_cache_opt_out_test.go",
]);

const CONFIG_UNIT_PREFIXES = [
  "as_",
  "file_url_",
  "format_block_",
  "project_rule_config_",
];

// Direct config operations use fixture files without evaluating a script host.
const CONFIG_UNIT_FILES = new Set([
  "load_rule_config_rejects_empty_extends_test.go",
  "load_rule_config_rejects_array_rules_test.go",
  "config_cache_does_not_memoize_failed_evaluation_test.go",
  "config_cache_reuses_evaluation_until_content_changes_test.go",
  "config_loader_sources_escape_every_literal_percent_test.go",
  "find_lint_config_file_discovers_nearest_ancestor_test.go",
  "find_lint_config_file_discovers_plain_lint_config_test.go",
  "find_lint_config_file_falls_back_to_cwd_for_out_of_tree_tsconfig_test.go",
  "find_lint_config_file_prefers_nearest_directory_test.go",
  "find_lint_config_file_rejects_same_directory_conflicts_test.go",
  "find_lint_config_file_uses_tsconfig_directory_when_outside_cwd_test.go",
  "inline_resolver_carries_options_in_resolved_config_test.go",
  "legacy_custom_resolver_keeps_rule_options_fallback_test.go",
  "load_config_file_rejects_unsupported_extension_test.go",
  "load_config_resolver_scopes_extends_options_in_engine_test.go",
  "load_json_config_file_rejects_invalid_json_test.go",
  "load_rule_config_configfile_overrides_discovery_test.go",
  "load_rule_config_discovers_cwd_config_for_out_of_tree_tsconfig_test.go",
  "load_rule_config_discovers_plain_lint_config_test.go",
  "load_rule_config_extends_with_ignores_and_rules_ignores_globally_test.go",
  "load_rule_config_honors_plugin_config_dir_env_test.go",
  "load_rule_config_loads_json_config_file_test.go",
  "load_rule_config_missing_config_error_names_search_origins_test.go",
  "load_rule_config_rejects_extends_cycle_between_two_configs_test.go",
  "load_rule_config_rejects_missing_discovered_config_test.go",
  "load_rule_config_rejects_overly_deep_extends_chain_test.go",
  "load_rule_config_rejects_self_referential_extends_test.go",
  "load_rule_config_resolves_configfile_relative_to_plugin_config_dir_env_test.go",
  "load_rule_config_resolves_linear_extends_chain_test.go",
  "loader_module_option_follows_the_config_package_type_test.go",
  "loader_rootdir_contains_loader_and_config_test.go",
  "loader_temp_base_stays_on_config_volume_test.go",
  "node_config_loader_env_prepends_nearest_node_modules_test.go",
  "node_package_manifest_from_resolves_a_relative_anchor_test.go",
  "node_package_manifest_from_skips_a_node_modules_directory_test.go",
  "node_platform_pair_matches_the_npm_platform_vocabulary_test.go",
  "parse_rules_accepts_eslint_tuples_in_standard_inline_config_test.go",
  "parse_rules_accepts_legacy_numeric_severities_test.go",
  "parse_rules_accepts_string_severities_test.go",
  "parse_rules_nil_treated_as_empty_test.go",
  "parse_rules_preserves_positional_options_test.go",
  "project_companion_preserves_file_scoped_rule_config_test.go",
  "resolve_config_file_path_uses_tsconfig_directory_test.go",
  "resolve_config_tsgo_falls_back_to_the_project_root_anchor_test.go",
  "resolve_config_tsgo_keeps_an_explicitly_pinned_compiler_test.go",
  "resolve_config_tsgo_prefers_the_config_anchor_over_the_project_root_test.go",
  "resolve_config_tsgo_resolves_the_project_compiler_without_the_environment_test.go",
  "resolve_config_tsgo_resolves_through_a_linked_typescript_install_test.go",
  "resolve_config_tsgo_returns_nothing_without_a_project_typescript_test.go",
  "resolve_config_tsgo_returns_nothing_without_the_platform_package_test.go",
  "resolve_ttsx_launcher_falls_back_to_the_bare_command_test.go",
  "resolve_ttsx_launcher_keeps_an_explicitly_pinned_binary_test.go",
  "resolve_ttsx_launcher_resolves_the_project_launcher_without_the_environment_test.go",
  "set_env_replaces_or_appends_test.go",
  "severity_string_formats_values_test.go",
  "ttsx_command_context_spawns_the_project_launcher_test.go",
  "windows_junction_dependency_entry_matches_node_fingerprint_test.go"
]);

function isUnitTest(relative) {
  const normalized = relative.split(path.sep).join("/");
  const directory = normalized.split("/")[0];
  const basename = path.basename(relative);
  if (PROCESS_TESTS.has(basename)) return false;
  if (UNIT_DIRECTORIES.has(directory) || directory === "fix" || directory === "command") return true;
  if (directory !== "config") return false;
  return (
    normalized.startsWith("config/external/") ||
    CONFIG_UNIT_FILES.has(basename) ||
    CONFIG_UNIT_PREFIXES.some((prefix) => basename.startsWith(prefix))
  );
}

/** Discover the original Go test functions and assign one owning layer each. */
function selectLintGoTests(packageTestDir, captured) {
  const unit = [];
  const e2e = [];
  const windows = [];
  const seen = new Set();
  const sources = {};
  const collect = ({ file, source }, owner) => {
    for (const match of source.matchAll(/^func (Test[A-Za-z0-9_]+)\s*\(/gm)) {
      const name = match[1];
      if (name === "TestMain") continue;
      if (seen.has(name)) throw new Error(`duplicate lint Go test: ${name}`);
      seen.add(name);
      sources[name] = path.basename(file);
      owner.push(name);
    }
  };
  const liveInputs = (directory) => walkForGoFiles(directory).map((file) => ({
    file,
    source: fs.readFileSync(file, "utf8"),
  }));
  for (const input of captured ? captured.packageFiles : liveInputs(packageTestDir)) {
    const { file } = input;
    const relative = path.relative(packageTestDir, file);
    collect(
      input,
      relative.split(path.sep).join("/").startsWith("os-boundaries/windows/")
        ? windows
        : isUnitTest(relative) ? unit : e2e,
    );
  }
  const requiredLayers = captured ? [captured.layer] : ["unit", "e2e"];
  const layers = { unit, e2e, windows };
  if (requiredLayers.some((layer) => !layers[layer]?.length))
    throw new Error(`lint Go test selection needs nonempty ${requiredLayers.join(" and ")} cases`);
  return { unit, e2e, windows, sources };
}

/** Call each existing test function once under a selected parent subtest. */
function writeLintGoSelection(location, names, layer, sources) {
  const wrapper =
    layer === "unit"
      ? "TestSelectedLintUnits"
      : layer === "windows"
        ? "TestSelectedLintWindowsBoundaries"
        : "TestSelectedLintBoundaries";
  fs.writeFileSync(
    location,
    [
      "package linthost",
      "",
      'import "testing"',
      "",
      `func ${wrapper}(t *testing.T) {`,
      ...names.flatMap((name) => [
        `//line ${sources[name]}:1`,
        `  t.Run(${JSON.stringify(name)}, ${name})`,
      ]),
      "//line lint_layer_selection_test.go:1",
      ...(layer === "unit"
        ? [
            "  if err := verifyRecordedBehavioralWitnessCoverage(); err != nil {",
            "    t.Error(err)",
            "  }",
          ]
        : []),
      "}",
      "",
    ].join("\n"),
  );
  return wrapper;
}

module.exports = { selectLintGoTests, writeLintGoSelection };
