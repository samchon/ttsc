import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a `lint.config.json` beside tsconfig.json is auto-discovered
 * and applied when the tsconfig plugin entry carries no `configFile` key.
 *
 * Pins the default, zero-configuration path: with the tsconfig plugin entry
 * reduced to `{ "transform": "@ttsc/lint" }`, the sidecar must walk upward from
 * the tsconfig directory and load the nearest `lint.config.*`. A regression
 * that required an explicit `configFile` pointer would silently lint nothing
 * for every project that relies on discovery.
 *
 * 1. Materialize a fixture whose plugin entry has no `configFile` key, with a
 *    `lint.config.json` (an ITtscLintConfig object) beside tsconfig.json.
 * 2. Run ttsc.
 * 3. Assert the discovered config's `noConsole` rule fires.
 */
export const test_lint_config_discovered_lint_config_file_applies_without_tsconfig_key =
  () => {
    const result = runLint({
      name: "config-discovered-no-tsconfig-key",
      source: SOURCE,
      pluginConfig: {},
      extraSources: {
        "lint.config.json": JSON.stringify({
          rules: { "noVar": "off", "noConsole": "error" },
        }),
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["noConsole", "error"]],
      result.stderr,
    );
  };
