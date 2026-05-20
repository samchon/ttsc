import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies that a flat-config `processor` is forwarded to the ESLint runtime
 * and that ttsc's output matches the ESLint API baseline.
 *
 * Pins the `processor` key forwarding path in the runtime bridge. The
 * `preprocess`/`postprocess` pair is part of the flat-config contract; if ttsc
 * strips the processor field the messages array from `postprocess` will be
 * missing, silently dropping all diagnostics from the processed file.
 *
 * 1. Materialise a project with a custom plugin that has a `ts` processor and a
 *    `no-forbidden-name` rule.
 * 2. Run both ttsc and the ESLint API against the same source.
 * 3. Assert the two diagnostic arrays are deeply equal.
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
