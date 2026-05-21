import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.mts` lint config file is evaluated correctly through ttsx.
 *
 * Pins the ESM TypeScript config extension branch. The loader must recognise
 * `.mts` as an ESM TypeScript file and invoke ttsx to evaluate it. This is the
 * ESM-TypeScript counterpart of the `.cts` test; both branches must be
 * exercised because the extension-based dispatch lives in a separate code path
 * from the generic `.ts` handler.
 *
 * 1. Materialise a fixture whose plugin entry sets `configFile:
 *    "./ttsc-lint.config.mts"`.
 * 2. The config default-exports an `ITtscLintConfig` object.
 * 3. Run ttsc; assert `no-var` fires from the loaded config.
 */
export const test_lint_config_file_mts_configs_load_through_ttsx = () => {
  const result = runLint({
    name: "config-file-mts",
    source: SOURCE,
    pluginConfig: {
      configFile: "./ttsc-lint.config.mts",
    },
    extraSources: {
      "ttsc-lint.config.mts": `export default {
        rules: { "no-var": "error" },
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
