import { assertESLintRuntimeParity } from "../../internal/config-file";

/**
 * Verifies that a shareable config package consumed via `import shared from
 * "eslint-config-ttsc-parity"` produces parity-matching output through ttsc's
 * ESLint runtime.
 *
 * Pins the `require`/`import` resolution path for shareable config packages.
 * The runtime must be able to `require` a config from the project's own
 * `node_modules`, not from the ttsc process's module graph. A resolution bug
 * would either throw `MODULE_NOT_FOUND` or silently apply no rules.
 *
 * 1. Materialise a project with a synthetic `eslint-config-ttsc-parity` package in
 *    `node_modules/` that defines a custom rule.
 * 2. Run both ttsc and the ESLint API against the same source.
 * 3. Assert the two diagnostic arrays are deeply equal.
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
