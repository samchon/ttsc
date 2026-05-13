import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint runtime matches package shareable config
 * output.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_runtime_matches_package_shareable_config_output =
  async () => {
    await assertESLintRuntimeParity({
      name: "config-file-eslint-runtime-shareable-package",
      source: `const forbidden = 1;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "eslint.config.mjs": `import shared from "eslint-config-ttsc-parity";

      export default [shared];\n`,
        "node_modules/eslint-config-ttsc-parity/package.json": JSON.stringify({
          type: "module",
          exports: "./index.mjs",
        }),
        "node_modules/eslint-config-ttsc-parity/index.mjs": `import tseslint from "typescript-eslint";

      const plugin = {
        rules: {
          "no-forbidden-name": {
            meta: {
              type: "problem",
              messages: {
                bad: "Forbidden identifier from shareable config.",
              },
            },
            create(context) {
              return {
                Identifier(node) {
                  if (node.name === "forbidden") {
                    context.report({ node, messageId: "bad" });
                  }
                },
              };
            },
          },
        },
      };

      export default {
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          local: plugin,
        },
        rules: {
          "local/no-forbidden-name": "error",
        },
      };\n`,
      },
    });
  };
