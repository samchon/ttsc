import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that flat-config `extends` arrays are reduced before the enclosing
 * entry's own `rules` so that local rules always take final precedence.
 *
 * Pins the reduction order for the Go-side config flattener. A base entry sets
 * `no-var: warn` and `no-console: error`; a nested array entry then sets
 * `no-console: off`; the top-level entry sets `no-var: error`. After reduction
 * only `no-var: error` (the local rule winning over the extended warn) should
 * fire — `no-console` is silenced by the nested extension. Wrong reduction
 * order would flip which rule fires.
 *
 * 1. Materialize a fixture with a nested `extends` structure in the config.
 * 2. Run ttsc with source containing both a `var` declaration and a `console.log`.
 * 3. Assert only `no-var` with severity `error` is reported (not `no-console`).
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
