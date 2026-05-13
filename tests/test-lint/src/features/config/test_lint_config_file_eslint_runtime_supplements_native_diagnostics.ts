import {
  assert,
  fakeEslintRuntimeModule,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies lint config file: ESLint runtime supplements native diagnostics.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_lint_config_file_eslint_runtime_supplements_native_diagnostics =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime-supplements-native",
      source: `const promise = Promise.resolve(1);\nconsole.log(promise);\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          plugins: {
            custom: {},
          },
          rules: {
            "custom/rule": "error",
            "no-console": "error",
          },
        },
      ];\n`,
        ...fakeEslintRuntimeModule("custom/rule", "External rule failed."),
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
        ["no-console", "error", "Unexpected console statement."],
        ["custom/rule", "error", "External rule failed."],
      ],
      result.stderr,
    );
  };
