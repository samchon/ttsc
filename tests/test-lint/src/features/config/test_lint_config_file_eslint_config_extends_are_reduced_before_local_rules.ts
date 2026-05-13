import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint config extends are reduced before local
 * rules.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_config_extends_are_reduced_before_local_rules =
  () => {
    const result = runLint({
      name: "config-file-eslint-extends",
      source: SOURCE,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default {
        extends: [
          {
            rules: {
              "no-var": "warn",
              "no-console": "error",
            },
          },
          [
            {
              rules: {
                "no-console": "off",
              },
            },
          ],
        ],
        rules: {
          "no-var": "error",
        },
      };\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-var", "error"]],
      result.stderr,
    );
  };
