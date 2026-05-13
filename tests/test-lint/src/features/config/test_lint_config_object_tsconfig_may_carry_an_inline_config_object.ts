import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config object: tsconfig may carry an inline config object.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_object_tsconfig_may_carry_an_inline_config_object =
  () => {
    const result = runLint({
      name: "config-inline-object",
      source: SOURCE,
      pluginConfig: {
        config: {
          "no-var": "off",
          "no-console": "error",
        },
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "error"]],
      result.stderr,
    );
  };
