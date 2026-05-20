import {
  assert,
  fakeEslintRuntimeModule,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies that ESLint runtime diagnostics are appended to the native
 * diagnostics stream rather than replacing them.
 *
 * Pins the merge path between the native engine output and the ESLint runtime
 * subprocess output. A native `no-console` rule fires; a fake ESLint runtime
 * also emits a `custom/rule` diagnostic. Both must appear in the final output
 * without a `"ignoring unknown rule"` warning for the custom rule (the runtime
 * handles it instead of the native engine). If ttsc routes all diagnostics
 * through only one path, one set will be missing.
 *
 * 1. Materialise a project with a fake ESLint runtime that emits `custom/rule`.
 * 2. Enable both `no-console` (native) and `custom/rule` (runtime).
 * 3. Assert both diagnostics appear in the merged output in order.
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
