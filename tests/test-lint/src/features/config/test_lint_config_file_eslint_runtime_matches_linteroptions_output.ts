import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint runtime matches linterOptions output.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
