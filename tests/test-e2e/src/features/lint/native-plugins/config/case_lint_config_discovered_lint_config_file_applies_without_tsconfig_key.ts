import { FixtureFiles } from "../../../../internal/FixtureFiles";
import { SOURCE, assert, runLint } from "../../../../internal/lint/internal/config-file";

/**
 * Verifies that a `lint.config.json` beside tsconfig.json is auto-discovered
 * and applied when the tsconfig plugin entry carries no `configFile` key.
 *
 * Pins the default, zero-configuration path: with the tsconfig plugin entry
 * reduced to `{ "transform": "@ttsc/lint" }`, the sidecar must walk upward from
 * the tsconfig directory and load the nearest `lint.config.*`. A regression
 * that required an explicit `configFile` pointer would silently lint nothing
 * for every project that relies on discovery.
 *
 * 1. Materialize a fixture whose plugin entry has no `configFile` key, with a
 *    `lint.config.json` (an ITtscLintConfig object) beside tsconfig.json.
 * 2. Run ttsc.
 * 3. Assert the discovered config's `no-console` rule fires.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual launcher receives an empty pluginConfig, discovers adjacent lint.config.json and reports exactly no-console/error while its explicit no-var off setting stays silent.
 * @evidence contracts/testing.md#independent-expectations The fixed source triggers both var and console choices; the authored config independently disables one and enables the other, establishing the literal one-finding expectation.
 * @evidence contracts/testing.md#distinguishing-cases No configFile is supplied, so a loader requiring an explicit pointer or using a stale default rule map fails; both positive console and negative var observations are retained.
 * @evidence contracts/testing.md#execution-ownership This named entry runs the real launcher/native config discovery, while packages/lint/linthost/find_lint_config_file_prefers_nearest_directory_test.go and find_lint_config_file_discovers_nearest_ancestor_test.go own direct local-versus-parent and absent-local/present-parent path selection without evaluating the script. Their source selection is not this launcher connection or current execution certification.
 * @evidence contracts/e2e.md#necessary-boundary A plugin entry without a configFile must still lead through descriptor/native discovery to actual configured rule output; direct resolver calls cannot prove the product supplies that zero-config context.
 * @evidence contracts/e2e.md#shared-execution One default-discovery launcher invocation jointly observes enabled and disabled rules, using shared workspace-selected tools and cache paths without this test certifying an actual cache hit or loaded artifact identity. Explicit-pointer language cases cannot alone prove this absent-pointer context.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The temporary consumer's source and adjacent config stay fixed; runLint attempts owned project cleanup in finally, with LintWorkspace owning the remaining parent lifetime. No previous consumer diagnostic result is reused; synchronous return is not arbitrary descendant join or reusable artifact-byte identity certification.
 * @evidence contracts/e2e.md#preserved-coverage Original no configFile input, failing error exit and exact sole no-console/error list remain executable, including the no-var-off negative. packages/lint/linthost/no_duplicate_imports_preserves_migrated_json_tuple_options_test.go::TestNoDuplicateImportsPreservesMigratedJSONTupleOptions owns the original JSON option tuple and exact option-dependent negative/line-4 positive; packages/lint/linthost/engine_preserves_migrated_disable_directive_population_test.go::TestEnginePreservesMigratedDisableDirectivePopulation owns the complete original ten-line directives and exact lines 1/8/10. Their untagged direct Go bodies are selected by root test:go, with current survivor runtime still unverified. This case owns generic config loading, native diagnostic transport and error exit without claiming to execute those rule-specific inputs.
 */
export function test_lint_config_discovered_lint_config_file_applies_without_tsconfig_key() {
    const result = runLint({
      name: "config-discovered-no-tsconfig-key",
      source: SOURCE,
      pluginConfig: {},
      extraSources: FixtureFiles.read("lint/lint_config_discovered_lint_config_file_applies_without_tsconfig_key/inputs-1"),
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "error"]],
      result.stderr,
    );
  }
