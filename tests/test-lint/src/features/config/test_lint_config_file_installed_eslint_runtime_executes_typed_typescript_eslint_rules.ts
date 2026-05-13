import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: installed ESLint runtime executes typed
 * typescript-eslint rules.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_installed_eslint_runtime_executes_typed_typescript_eslint_rules =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime-real-typescript-eslint-typed",
      source: `Promise.resolve(1);\n`,
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
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: import.meta.dirname,
          },
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-floating-promises": "error",
        },
      });\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["@typescript-eslint/no-floating-promises", "error"]],
      result.stderr,
    );
    const diagnostic = result.diagnostics[0];
    assert.ok(diagnostic);
    assert.match(diagnostic.message, /Promises must be awaited/);
  };
