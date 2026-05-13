import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that setting both `rules` and `extends` on the same tsconfig plugin
 * entry is rejected with an explicit error.
 *
 * Pins the mutual-exclusion guard between the two new ESLint-flat-config
 * fields: a user who tries to inline overrides AND point at a file should learn
 * loudly which one to drop, instead of one silently winning and the other being
 * ignored. A regression that picked one and dropped the other would let the
 * user's intent silently halve.
 *
 * 1. Materialize a fixture whose tsconfig plugin entry sets both `rules: {...}`
 *    and `extends: "./..."`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr names both keys with `cannot be combined`.
 */
export const test_lint_config_rules_and_extends_mixed_on_same_entry_is_rejected =
  () => {
    const result = runLint({
      name: "config-rules-and-extends-mixed",
      source: "export const ok = 1;\n",
      pluginConfig: {
        rules: { "no-var": "error" },
        extends: "./lint.config.ts",
      },
      extraSources: {
        "lint.config.ts": `export default { "no-console": "error" };\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /"rules" and "extends" cannot be combined/);
  };
