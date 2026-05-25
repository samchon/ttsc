import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `.cts` lint config file is evaluated correctly through ttsx.
 *
 * Pins the CJS TypeScript config extension branch. The loader must recognise
 * `.cts` as a CommonJS TypeScript file, invoke ttsx, and accept the `export =`
 * assignment export form. Without this, users who set `"type": "module"` in
 * their project and write a CJS config file would silently get no rules.
 *
 * 1. Materialize a fixture whose plugin entry sets `configFile:
 *    "./ttsc-lint.config.cts"`.
 * 2. The config exports an `ITtscLintConfig` object via `export = config` (CJS).
 * 3. Run ttsc; assert `no-console` fires from the loaded config.
 */
export const test_lint_config_file_cts_configs_load_through_ttsx = () => {
  const result = runLint({
    name: "config-file-cts",
    source: SOURCE,
    pluginConfig: {
      configFile: "./ttsc-lint.config.cts",
    },
    extraSources: {
      "ttsc-lint.config.cts": `const config = {
        rules: { "no-console": "error" },
      };

      export = config;\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-console", "error"]],
    result.stderr,
  );
};
