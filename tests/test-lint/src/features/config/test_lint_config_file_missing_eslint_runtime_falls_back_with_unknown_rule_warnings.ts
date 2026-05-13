import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: missing ESLint runtime falls back with
 * unknown-rule warnings.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_missing_eslint_runtime_falls_back_with_unknown_rule_warnings =
  () => {
    const result = runLint({
      name: "config-file-eslint-missing-runtime-fallback-warning",
      source: `const promise = Promise.resolve(1);\nvoid promise;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          rules: {
            "@typescript-eslint/no-floating-promises": "error",
          },
        },
      ];\n`,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.diagnostics.length, 0, result.stderr);
    assert.match(
      result.stderr,
      /@ttsc\/lint: ignoring unknown rule "no-floating-promises"/,
    );
  };
