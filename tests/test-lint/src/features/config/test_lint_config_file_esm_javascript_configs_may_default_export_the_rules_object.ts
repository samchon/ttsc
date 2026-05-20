import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.mjs` lint config may default-export a bare rules map
 * (rather than a full `ITtscLintConfig` object).
 *
 * Pins the ESM JavaScript config extension branch and the raw-map coercion
 * path. Users without a build step often write `export default { "no-var":
 * "error" }` in a `.mjs` file; the loader must recognise the flat rules object
 * and not require it to be wrapped in `{ rules: ... }`.
 *
 * 1. Materialise a fixture with a `.mjs` config file that bare-exports a rules
 *    map.
 * 2. Run ttsc; assert `no-var` fires.
 */
export const test_lint_config_file_esm_javascript_configs_may_default_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-mjs",
      source: SOURCE,
      pluginConfig: {
        config: "./ttsc-lint.config.mjs",
      },
      extraSources: {
        "ttsc-lint.config.mjs": `export default {
        "no-var": "error",
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
