import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies inline `rules` field replaces the legacy `config` object form.
 *
 * Pins the canonical ESLint-flat-config-shaped `rules` key on a tsconfig plugin
 * entry: an inline severity map should apply directly without any
 * `lint.config.*` lookup and without emitting the legacy deprecation notice. A
 * regression that re-routed the field back through the legacy `config` branch
 * would lose this signal.
 *
 * 1. Materialize a fixture whose tsconfig plugin entry sets only `rules: {
 *    "no-console": "error" }`.
 * 2. Run ttsc with the source the legacy config tests use.
 * 3. Assert one `no-console` error fires and stderr contains no deprecation notice
 *    for `"config"`.
 */
export const test_lint_config_inline_rules_field_replaces_legacy_config_object =
  () => {
    const result = runLint({
      name: "config-inline-rules-field",
      source: SOURCE,
      pluginConfig: {
        rules: {
          "no-var": "off",
          "no-console": "error",
        },
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "error"]],
      result.stderr,
    );
    assert.doesNotMatch(result.stderr, /"config" is deprecated/);
  };
