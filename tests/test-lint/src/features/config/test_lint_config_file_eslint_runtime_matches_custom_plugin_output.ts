import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies that a custom inline ESLint plugin (with `options` and `settings`)
 * produces the same diagnostics through ttsc's ESLint runtime as it does
 * through the ESLint API directly.
 *
 * Pins the rule-option and settings-forwarding paths in the runtime bridge. The
 * custom rule reads `context.options[0].label` and `context.settings.
 * localSource`; if either is dropped during bridging the message text will
 * differ from the parity baseline.
 *
 * 1. Materialise a project with a custom plugin rule that uses per-rule options
 *    and flat-config `settings`.
 * 2. Run both ttsc and the ESLint API against the same source.
 * 3. Assert the two diagnostic arrays are deeply equal.
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
