import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that the reserved alias `configFile` is rejected with a hint
 * pointing at `extends`.
 *
 * Pins the migration ergonomics. `configFile` is a natural guess for users
 * coming from other tooling, so the sidecar reserves the key and surfaces an
 * explicit redirect to `extends` instead of treating the field as plugin-owned
 * data that gets silently ignored. `configPath` is symmetric and covered by the
 * same code path.
 *
 * 1. Materialize a fixture whose plugin entry uses `configFile: "./..."`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr mentions both `"configFile"` and `"extends"`.
 */
export const test_lint_config_configfile_alias_is_rejected_with_extends_hint =
  () => {
    const result = runLint({
      name: "config-configfile-alias",
      source: "export const ok = 1;\n",
      pluginConfig: {
        configFile: "./lint.config.ts",
      },
      extraSources: {
        "lint.config.ts": `export default { "no-var": "error" };\n`,
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /"configFile" is not supported/);
    assert.match(result.stderr, /"extends"/);
  };
