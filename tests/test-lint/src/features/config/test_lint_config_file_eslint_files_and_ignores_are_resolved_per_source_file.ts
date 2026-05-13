import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint files and ignores are resolved per source
 * file.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_files_and_ignores_are_resolved_per_source_file =
  () => {
    const result = runLint({
      name: "config-file-eslint-files-ignores",
      source: SOURCE,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "src/example.test.ts": SOURCE,
        "src/generated.ts": SOURCE,
        "eslint.config.mjs": `export default [
        {
          rules: {
            "no-var": "error",
            "no-console": "error",
          },
        },
        {
          files: ["src/**/*.test.ts"],
          rules: {
            "no-console": "off",
          },
        },
        {
          ignores: ["src/generated.ts"],
        },
      ];\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.file, d.rule, d.severity]).sort(),
      [
        ["src/example.test.ts", "no-var", "error"],
        ["src/main.ts", "no-console", "error"],
        ["src/main.ts", "no-var", "error"],
      ],
      result.stderr,
    );
  };
