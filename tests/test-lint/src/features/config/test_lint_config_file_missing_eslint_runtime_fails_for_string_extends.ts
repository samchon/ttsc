import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: missing ESLint runtime fails for string extends.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_missing_eslint_runtime_fails_for_string_extends =
  () => {
    const result = runLint({
      name: "config-file-eslint-missing-runtime-string-extends",
      source: SOURCE,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          extends: ["eslint/recommended"],
          rules: {
            "no-var": "error",
          },
        },
      ];\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ESLint runtime is required/);
  };
