import {
  assert,
  fakeEslintRuntimeModule,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies lint config file: installed ESLint runtime executes external
 * RuleModules.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_installed_eslint_runtime_executes_external_rulemodules =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime",
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
        ...fakeEslintRuntimeModule(
          "@typescript-eslint/no-floating-promises",
          "Promises must be awaited.",
        ),
      },
    });

    assert.notEqual(result.status, 0);
    assert.equal(
      result.stderr.includes("@ttsc/lint: ignoring unknown rule"),
      false,
      result.stderr,
    );
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity, d.message]),
      [
        [
          "@typescript-eslint/no-floating-promises",
          "error",
          "Promises must be awaited.",
        ],
      ],
      result.stderr,
    );
  };
