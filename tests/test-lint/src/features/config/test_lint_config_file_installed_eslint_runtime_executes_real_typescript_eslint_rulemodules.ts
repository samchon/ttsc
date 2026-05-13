import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: installed ESLint runtime executes real
 * typescript-eslint RuleModules.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_installed_eslint_runtime_executes_real_typescript_eslint_rulemodules =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime-real-typescript-eslint",
      source: `const value: any = 1;\nconsole.log(value);\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config({
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-explicit-any": "error",
          "no-console": "off",
        },
      });\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.equal(
      result.stderr.includes("@ttsc/lint: ignoring unknown rule"),
      false,
      result.stderr,
    );
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity, d.message]),
      [
        [
          "@typescript-eslint/no-explicit-any",
          "error",
          "Unexpected any. Specify a different type.",
        ],
      ],
      result.stderr,
    );
  };
