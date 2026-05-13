import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint runtime matches inline disable output.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_runtime_matches_inline_disable_output =
  async () => {
    await assertESLintRuntimeParity({
      name: "config-file-eslint-runtime-inline-disable",
      source: `const reported: any = 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skipped: any = reported;
`,
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
          "@typescript-eslint/no-explicit-any": "error",
        },
      });\n`,
      },
    });
  };
