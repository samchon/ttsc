import { TestExecutor } from "@ttsc/testing";
import path from "node:path";

TestExecutor.main({
  location: path.join(process.cwd(), "src", "features"),
  // The 600+ fixture corpus dominates wall time; it runs in every shard and
  // slices its own case list by `TTSC_TEST_SHARD_ACTIVE`, so it must not pin a
  // whole lane. The remaining heavy tests each rebuild the native lint engine.
  spanning: ["test_lint_rules_corpus_matches_expected_diagnostics"],
  weights: {
    test_lint_fix_contributor_rule_single_edit_applies_through_native_engine: 116000,
    test_lint_config_file_wrapper_tsconfig_outside_cwd_discovers_wrapper_config: 114000,
    test_lint_config_discovered_lint_config_file_applies_without_tsconfig_key: 113000,
    test_lint_contributor_plugin_discovered_from_lint_config_ts: 13000,
    test_lint_fix_native_project_rewrites_temp_copy_only: 12000,
  },
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
