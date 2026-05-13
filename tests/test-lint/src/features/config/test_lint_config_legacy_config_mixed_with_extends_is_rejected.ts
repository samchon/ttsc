import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that combining legacy `config` with the new `extends` field on the
 * same tsconfig plugin entry is rejected.
 *
 * Pins the migration guard's second arm — symmetric with the `config + rules`
 * case. The two new fields each cover one half of what legacy `config` used to
 * do, so both halves need the same loud-reject treatment when paired with the
 * deprecated key.
 *
 * 1. Materialize a fixture whose plugin entry sets both `config: "./..."` and
 *    `extends: "./..."`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr says `mixes legacy "config"`.
 */
export const test_lint_config_legacy_config_mixed_with_extends_is_rejected =
  () => {
    const result = runLint({
      name: "config-legacy-config-mixed-extends",
      source: "export const ok = 1;\n",
      pluginConfig: {
        config: "./legacy.config.ts",
        extends: "./lint.config.ts",
      },
      extraSources: {
        "legacy.config.ts": `export default { "no-var": "error" };\n`,
        "lint.config.ts": `export default { "no-console": "error" };\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /mixes legacy "config"/);
  };
