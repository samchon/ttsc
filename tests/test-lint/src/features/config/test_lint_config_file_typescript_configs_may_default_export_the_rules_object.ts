import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: TypeScript configs may default-export the rules
 * object.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_typescript_configs_may_default_export_the_rules_object =
  () => {
    const result = runLint({
      name: "config-file-ts",
      source: SOURCE,
      pluginConfig: {
        config: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "ttsc-lint.config.ts": `export default {
        "no-var": "error",
        "no-console": "off",
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
