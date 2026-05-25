import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.cjs` lint config exports an `ITtscLintConfig` object via
 * `module.exports = { rules: { ... } }`.
 *
 * Pins the CommonJS config-file loader. The loader must accept the
 * `module.exports` object and read its `rules` map. The test also verifies
 * severity normalisation: the string `"warning"` must render as `"warn"` in the
 * diagnostic output.
 *
 * 1. Materialise a fixture with a `.cjs` config that exports `{ rules: {
 *    "no-console": "warning" } }`.
 * 2. Run ttsc; assert the diagnostic severity is `"warn"` (not `"warning"`).
 */
export const test_lint_config_file_javascript_configs_may_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-js",
      source: SOURCE,
      pluginConfig: {
        configFile: "./ttsc-lint.config.cjs",
      },
      extraSources: {
        "ttsc-lint.config.cjs": `module.exports = {
        rules: { "no-console": "warning" },
      };\n`,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "warn"]],
      result.stderr,
    );
  };
