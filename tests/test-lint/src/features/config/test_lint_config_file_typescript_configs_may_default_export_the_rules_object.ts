import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.ts` lint config default-exports an `ITtscLintConfig` object
 * evaluated through ttsx.
 *
 * Pins the generic TypeScript config loader path. The loader spawns ttsx,
 * type-checks and transpiles the config, then reads the default export's
 * `rules` map. This is the simplest TypeScript config shape.
 *
 * 1. Materialise a fixture with a `.ts` config that default-exports `{ rules: {
 *    ... } }`.
 * 2. Run ttsc; assert `no-var` fires from the loaded config.
 */
export const test_lint_config_file_typescript_configs_may_default_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-ts",
      source: SOURCE,
      pluginConfig: {
        configFile: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "ttsc-lint.config.ts": `export default {
        rules: {
          "no-var": "error",
          "no-console": "off",
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
