import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: .cts configs load through ttsx.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_cts_configs_load_through_ttsx = () => {
  const result = runLint({
    name: "config-file-cts",
    source: SOURCE,
    pluginConfig: {
      config: "./ttsc-lint.config.cts",
    },
    extraSources: {
      "ttsc-lint.config.cts": `const config = {
        "no-console": "error",
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
