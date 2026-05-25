import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.mjs` lint config default-exports an `ITtscLintConfig`
 * object.
 *
 * Pins the ESM JavaScript config extension branch. Node cannot `require()` an
 * ESM file synchronously, so `.mjs` configs are evaluated through the same
 * dynamic-import loader as `.ts` configs. The loader must read the default
 * export's `rules` map.
 *
 * 1. Materialise a fixture with a `.mjs` config that default-exports `{ rules: {
 *    "noVar": "error" } }`.
 * 2. Run ttsc; assert `noVar` fires.
 */
export const test_lint_config_file_esm_javascript_configs_may_default_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-mjs",
      source: SOURCE,
      pluginConfig: {
        configFile: "./ttsc-lint.config.mjs",
      },
      extraSources: {
        "ttsc-lint.config.mjs": `export default {
        rules: { "noVar": "error" },
      };\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["noVar", "error"]],
      result.stderr,
    );
  };
