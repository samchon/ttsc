import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint runtime matches processor output.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_runtime_matches_processor_output =
  async () => {
    await assertESLintRuntimeParity({
      name: "config-file-eslint-runtime-processor",
      source: `const forbidden = 1;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
      extraSources: {
        "eslint.config.mjs": `const plugin = {
        processors: {
          ts: {
            preprocess(text, filename) {
              return [{ text, filename }];
            },
            postprocess(messages) {
              return messages.flat();
            },
            supportsAutofix: true,
          },
        },
        rules: {
          "no-forbidden-name": {
            meta: {
              type: "problem",
              messages: {
                bad: "Forbidden identifier from processor.",
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

      export default [{
        files: ["src/**/*.ts"],
        plugins: {
          local: plugin,
        },
        processor: "local/ts",
        rules: {
          "local/no-forbidden-name": "error",
        },
      }];\n`,
      },
    });
  };
