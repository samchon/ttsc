import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.cjs` lint config may export a bare rules map via
 * `module.exports = { ... }` (no wrapping object needed).
 *
 * Pins the CommonJS bare-export coercion path. The loader must accept the raw
 * `module.exports` object as a rules map when it does not have a `rules` or
 * `extends` key. The test also verifies severity normalisation: the string
 * `"warning"` must be treated as `"warn"` in the diagnostic output.
 *
 * 1. Materialise a fixture with a `.cjs` config that exports `{ "no-console":
 *    "warning" }`.
 * 2. Run ttsc; assert the diagnostic severity is `"warn"` (not `"warning"`).
 */
export const test_lint_config_file_javascript_configs_may_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-js",
      source: SOURCE,
      pluginConfig: {
        config: "./ttsc-lint.config.cjs",
      },
      extraSources: {
        "ttsc-lint.config.cjs": `module.exports = {
        "no-console": "warning",
      };\n`,
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "warn"]],
      result.stderr,
    );
  };
