import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: JavaScript configs may export the rules object.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_javascript_configs_may_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-js",
      source: SOURCE,
      pluginConfig: {
        config: "./ttsc-lint.config.cjs",
      },
      extraSources: {
        "ttsc-lint.config.cjs": `module.exports = {
        "no-console": "warning",
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
