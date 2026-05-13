import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: TypeScript configs can use exported @ttsc/lint
 * types.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_typescript_configs_can_use_exported_ttsc_lint_types =
  () => {
    const result = runLint({
      name: "config-file-ts-satisfies-native-type",
      source: SOURCE,
      pluginConfig: {
        config: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "ttsc-lint.config.ts": `import type { TtscLintConfig } from "@ttsc/lint";

      const config = {
        "no-var": "error",
        "no-console": "off",
      } satisfies TtscLintConfig;

      export default config;\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-var", "error"]],
      result.stderr,
    );
  };
