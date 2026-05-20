import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies that column numbers for diagnostics after a multi-code-unit Unicode
 * character (emoji) match between ttsc's ESLint runtime and the ESLint API.
 *
 * ESLint reports columns in UTF-16 code units; TypeScript-Go's native engine
 * uses byte offsets. The runtime bridge must re-encode column numbers before
 * merging. An emoji (`😀`, U+1F600) occupies two UTF-16 code units, so any
 * identifier after it shifts by one column. This test pins the off-by-one
 * regression that would occur if the bridge used UTF-8 byte counts instead.
 *
 * 1. Materialise a project with `const emoji = "😀"; forbidden();` as source.
 * 2. Run both ttsc and the ESLint API against the same source.
 * 3. Assert the two diagnostic arrays are deeply equal including column numbers.
 */
export const test_lint_config_file_eslint_runtime_matches_utf_16_columns =
  async () => {
    await assertESLintRuntimeParity({
      name: "config-file-eslint-runtime-utf16-column",
      source: `const emoji = "😀"; forbidden();\n`,
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
              messages: {
                bad: "Forbidden identifier after emoji.",
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
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          local: plugin,
        },
        rules: {
          "local/no-forbidden-name": "error",
        },
      }];\n`,
      },
    });
  };
