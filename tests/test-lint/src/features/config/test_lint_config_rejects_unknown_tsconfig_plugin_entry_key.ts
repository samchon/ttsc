import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies the `@ttsc/lint` tsconfig plugin entry rejects any key other than
 * the host framework keys and `configFile`.
 *
 * Pins the migration guard added when inline tsconfig options were withdrawn:
 * rule, format, and plugin settings now live only in a `lint.config.*` file. A
 * stale inline `rules` key left in `tsconfig.json` must fail loudly — silently
 * ignoring it would drop the project's lint policy with no signal. Mirrors the
 * equivalent guard in `@ttsc/banner` and `@ttsc/strip`.
 *
 * 1. Materialize a fixture whose plugin entry still carries an inline `rules` key.
 * 2. Run ttsc.
 * 3. Assert a non-zero exit and an "unsupported key" error that names `rules`.
 */
export const test_lint_config_rejects_unknown_tsconfig_plugin_entry_key =
  () => {
    const result = runLint({
      name: "config-rejects-unknown-tsconfig-key",
      source: SOURCE,
      pluginConfig: { rules: { "noConsole": "error" } },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /unsupported key "rules"/);
  };
