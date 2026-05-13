import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that combining legacy `config` with the new `rules` field on the
 * same tsconfig plugin entry is rejected.
 *
 * Pins the migration guard: a user mid-rename who left `config` in place while
 * adding `rules` should learn that the two fields are mutually exclusive,
 * instead of silent precedence between deprecated and current keys. Letting
 * both through would mask the legacy field's removal path.
 *
 * 1. Materialize a fixture whose plugin entry sets both `config: {...}` and
 *    `rules: {...}`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr mentions both keys with `mixes legacy
 *    "config"`.
 */
export const test_lint_config_legacy_config_mixed_with_rules_is_rejected =
  () => {
    const result = runLint({
      name: "config-legacy-config-mixed-rules",
      source: "export const ok = 1;\n",
      pluginConfig: {
        config: { "no-var": "error" },
        rules: { "no-console": "error" },
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /mixes legacy "config"/);
  };
