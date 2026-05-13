import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint runtime matches custom plugin output.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_runtime_matches_custom_plugin_output =
  async () => {
    await assertESLintRuntimeParity({
      name: "config-file-eslint-runtime-custom-plugin",
      source: `const forbidden = 1;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "eslint.config.mjs": `import tseslint from "typescript-eslint";

      const plugin = {
        rules: {
          "no-forbidden-name": {
            meta: {
              type: "problem",
              schema: [
                {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                  },
                  additionalProperties: false,
                },
              ],
              messages: {
                bad: "Forbidden identifier from {{label}} via {{source}}.",
              },
            },
            create(context) {
              const label = context.options[0]?.label ?? "missing option";
              const source = context.settings.localSource ?? "missing setting";
              return {
                Identifier(node) {
                  if (node.name === "forbidden") {
                    context.report({
                      node,
                      messageId: "bad",
                      data: { label, source },
                    });
                  }
                },
              };
            },
          },
        },
      };

      export default [{
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          local: plugin,
        },
        settings: {
          localSource: "settings",
        },
        rules: {
          "local/no-forbidden-name": ["error", { label: "rule option" }],
        },
      }];\n`,
      },
    });
  };
