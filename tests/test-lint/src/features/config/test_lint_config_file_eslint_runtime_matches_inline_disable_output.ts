import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies that `eslint-disable-next-line` inline directives are honoured by
 * the ESLint runtime and that ttsc's output matches the ESLint API baseline.
 *
 * Pins the inline-disable forwarding path in the runtime bridge. ESLint
 * suppresses the `no-explicit-any` diagnostic on the disabled line; if ttsc
 * drops the suppression signal or re-emits the skipped diagnostic, the parity
 * check fails.
 *
 * 1. Materialise a project with two `any` variables, one disabled with
 *    `eslint-disable-next-line`.
 * 2. Run both ttsc and the ESLint API against the same source.
 * 3. Assert the two diagnostic arrays are deeply equal (only the un-disabled `any`
 *    is reported).
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
