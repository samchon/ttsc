import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint flat config arrays are reduced to rules
 * maps.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_flat_config_arrays_are_reduced_to_rules_maps =
  () => {
    const result = runLint({
      name: "config-file-eslint-flat-array",
      source: SOURCE,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          rules: {
            "no-var": "off",
            "no-console": "warn",
          },
        },
        {
          files: ["src/**/*.ts"],
          rules: {
            "no-var": ["error", { ignore: true }],
            "no-console": "off",
          },
        },
      ];\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-var", "error"]],
      result.stderr,
    );
  };
