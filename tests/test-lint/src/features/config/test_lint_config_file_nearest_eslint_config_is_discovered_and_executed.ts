import {
  assert,
  fakeEslintRuntimeModule,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies lint config file: nearest eslint.config is discovered and executed.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_nearest_eslint_config_is_discovered_and_executed =
  () => {
    const result = runLint({
      name: "config-file-eslint-auto-discovery",
      source: `const promise = Promise.resolve(1);\nvoid promise;\n`,
      pluginConfig: {},
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          extends: ["eslint/recommended"],
          plugins: {
            "@typescript-eslint": {},
          },
          rules: {
            "@typescript-eslint/no-floating-promises": "error",
          },
        },
      ];\n`,
        ...fakeEslintRuntimeModule(
          "@typescript-eslint/no-floating-promises",
          "Auto-discovered config executed.",
        ),
      },
    });

    assert.notEqual(result.status, 0);
    assert.equal(
      result.stderr.includes("@ttsc/lint: ignoring unknown rule"),
      false,
      result.stderr,
    );
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity, d.message]),
      [
        [
          "@typescript-eslint/no-floating-promises",
          "error",
          "Auto-discovered config executed.",
        ],
      ],
      result.stderr,
    );
  };
