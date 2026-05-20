import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a flat-config array is reduced to a single rules map that the
 * native engine can consume, with later entries overriding earlier ones for the
 * same file glob.
 *
 * Pins the array-reduction logic in the Go-side config loader. A first entry
 * sets `no-console: warn` and `no-var: off`; a second entry matching the same
 * `files` glob then sets `no-var: error` and `no-console: off`. After reduction
 * only `no-var: error` should fire. A broken reducer that skips the second
 * entry, or applies both entries without per-file merging, would emit the wrong
 * rule.
 *
 * 1. Materialize a fixture whose config is a two-entry flat array.
 * 2. Run ttsc on a source with a `var` declaration and a `console.log`.
 * 3. Assert only `no-var` with severity `error` fires.
 */
export const test_lint_config_file_eslint_flat_config_arrays_are_reduced_to_rules_maps =
  () => {
    const result = runLint({
      name: "config-file-eslint-flat-array",
      source: SOURCE,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          rules: {
            "no-var": "off",
            "no-console": "warn",
          },
        },
        {
          files: ["src/**/*.ts"],
          rules: {
            "no-var": ["error", { ignore: true }],
            "no-console": "off",
          },
        },
      ];\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-var", "error"]],
      result.stderr,
    );
  };
