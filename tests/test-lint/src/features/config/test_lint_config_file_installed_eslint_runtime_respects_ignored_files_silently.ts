import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: installed ESLint runtime respects ignored files
 * silently.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_installed_eslint_runtime_respects_ignored_files_silently =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime-ignored-files",
      source: `export const value: any = 1;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "src/generated.ts": `export const generated: any = 1;\n`,
        "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config(
        {
          ignores: ["src/generated.ts"],
        },
        {
          files: ["src/**/*.ts"],
          languageOptions: {
            parser: tseslint.parser,
          },
          plugins: {
            "@typescript-eslint": tseslint.plugin,
          },
          rules: {
            "@typescript-eslint/no-explicit-any": "error",
          },
        },
      );\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.file, d.rule, d.severity]),
      [["src/main.ts", "@typescript-eslint/no-explicit-any", "error"]],
      result.stderr,
    );
  };
