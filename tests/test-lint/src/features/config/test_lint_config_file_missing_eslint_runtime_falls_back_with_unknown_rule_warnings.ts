import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that using a namespaced rule (e.g. `@typescript-eslint/…`) without
 * an installed `eslint` package degrades gracefully: ttsc exits zero, emits no
 * diagnostic for the unknown rule, but logs a per-rule warning.
 *
 * Pins the graceful-fallback path for unrecognised rule names that lack a
 * `plugins` entry. Without a plugin declaration, the native engine cannot
 * classify the rule as runtime-only, so it warns and skips rather than
 * hard-failing. A regression that drops the warning would leave users confused
 * about why their `@typescript-eslint` rules do nothing.
 *
 * 1. Materialise a fixture with `@typescript-eslint/no-floating-promises: error`
 *    and no `eslint` package.
 * 2. Run ttsc; assert zero exit, zero diagnostics, and a `"ignoring unknown rule"`
 *    warning for the namespaced rule in stderr.
 */
export const test_lint_config_file_missing_eslint_runtime_falls_back_with_unknown_rule_warnings =
  () => {
    const result = runLint({
      name: "config-file-eslint-missing-runtime-fallback-warning",
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
      },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.diagnostics.length, 0, result.stderr);
    assert.match(
      result.stderr,
      /@ttsc\/lint: ignoring unknown rule "no-floating-promises"/,
    );
  };
