import {
  assert,
  fakeEslintRuntimeModule,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies that the ESLint runtime executes rules from an installed external
 * rule module (e.g. `@typescript-eslint/no-floating-promises`).
 *
 * Pins the external-module resolution path. When the config references a rule
 * by its namespaced plugin ID and the eslint runtime is installed, the host
 * must delegate to the runtime's `lintFiles` rather than attempting to look up
 * the rule in the native corpus. A fake ESLint runtime module is used so the
 * test is hermetic and fast.
 *
 * 1. Materialise a project with a fake `eslint` runtime that emits a diagnostic
 *    for `@typescript-eslint/no-floating-promises`.
 * 2. Run ttsc; assert the diagnostic appears with no `"ignoring unknown rule"`
 *    warning (the runtime handled it).
 */
export const test_lint_config_file_installed_eslint_runtime_executes_external_rulemodules =
  () => {
    const result = runLint({
      name: "config-file-eslint-runtime",
      source: `const promise = Promise.resolve(1);\nvoid promise;\n`,
      pluginConfig: {
        config: "./eslint.config.mjs",
      },
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          rules: {
            "@typescript-eslint/no-floating-promises": "error",
          },
        },
      ];\n`,
        ...fakeEslintRuntimeModule(
          "@typescript-eslint/no-floating-promises",
          "Promises must be awaited.",
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
          "Promises must be awaited.",
        ],
      ],
      result.stderr,
    );
  };
