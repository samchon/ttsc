import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies that ttsc's ESLint runtime mode produces diagnostics identical to
 * calling the ESLint API directly with the same config.
 *
 * This is the primary parity contract for the ESLint runtime bridge. The ttsc
 * host spawns the real ESLint API in a subprocess, collects its output, and
 * merges it with native diagnostics. If the host's column/line mapping, rule
 * name normalisation, or message transcription diverges from what ESLint
 * reports, this test catches it.
 *
 * 1. Materialise a project with `typescript-eslint` installed and a typed-rule
 *    config (`no-explicit-any` + `no-floating-promises`).
 * 2. Run both ttsc and the ESLint API directly against the same source.
 * 3. Assert the two diagnostic arrays are deeply equal.
 */
export const test_lint_config_file_eslint_runtime_diagnostics_match_eslint_api_output =
  async () => {
    await assertESLintRuntimeParity({
      name: "config-file-eslint-runtime-parity",
      source: `const value: any = 1;\nPromise.resolve(value);\n`,
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
          "@typescript-eslint/no-floating-promises": "error",
        },
      });\n`,
      },
    });
  };
