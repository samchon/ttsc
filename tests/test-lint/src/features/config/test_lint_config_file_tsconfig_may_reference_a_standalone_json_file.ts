import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: tsconfig may reference a standalone JSON file.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_tsconfig_may_reference_a_standalone_json_file =
  () => {
    const result = runLint({
      name: "config-file-json",
      source: SOURCE,
      pluginConfig: {
        config: "./ttsc-lint.config.json",
      },
      extraSources: {
        "ttsc-lint.config.json": JSON.stringify({
          "no-var": "error",
        }),
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-var", "error"]],
      result.stderr,
    );
  };
