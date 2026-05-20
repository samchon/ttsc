import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies that `linterOptions.noInlineConfig` is honoured by the ESLint
 * runtime and that ttsc's output matches the ESLint API baseline.
 *
 * Pins the `linterOptions` forwarding path in the runtime bridge. With
 * `noInlineConfig: true`, ESLint ignores `/* eslint-disable no-console *\/` and
 * still reports the violation. If ttsc drops `linterOptions` the ESLint API
 * call will behave differently, breaking parity.
 *
 * 1. Materialise a project with `linterOptions: { noInlineConfig: true }` and a
 *    `/* eslint-disable no-console *\/` inline directive in the source.
 * 2. Run both ttsc and the ESLint API against the same source.
 * 3. Assert the two diagnostic arrays are deeply equal (`no-console` fires despite
 *    the inline disable because noInlineConfig is active).
 */
export const test_lint_config_file_eslint_runtime_matches_linteroptions_output =
  async () => {
    await assertESLintRuntimeParity({
      name: "config-file-eslint-runtime-linter-options",
      source: `/* eslint-disable no-console */\nconsole.log(1);\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "eslint.config.mjs": `export default [{
        files: ["src/**/*.ts"],
        linterOptions: {
          noInlineConfig: true,
        },
        rules: {
          "no-console": "error",
        },
      }];\n`,
      },
    });
  };
