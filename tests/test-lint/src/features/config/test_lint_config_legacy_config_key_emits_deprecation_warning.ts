import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies the legacy `config` key emits a deprecation notice while keeping its
 * existing behavior.
 *
 * Pins the deprecation contract for `compilerOptions.plugins[*].config`: the
 * field continues to accept the inline-map and file-path shapes (so existing
 * 0.10.x configs do not break on upgrade), but the sidecar prints a single-line
 * warning to stderr pointing users at the new `rules` / `extends` fields.
 * Losing the warning would let the legacy field silently outlive its
 * deprecation window.
 *
 * 1. Materialize a fixture that uses the legacy inline-object `config` form on the
 *    tsconfig plugin entry.
 * 2. Run ttsc; assert the configured rule still fires.
 * 3. Assert stderr contains the deprecation notice referencing both new field
 *    names.
 */
export const test_lint_config_legacy_config_key_emits_deprecation_warning =
  () => {
    const result = runLint({
      name: "config-legacy-deprecation",
      source: SOURCE,
      pluginConfig: {
        config: {
          "no-var": "off",
          "no-console": "error",
        },
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "error"]],
      result.stderr,
    );
    assert.match(
      result.stderr,
      /"config" is deprecated/,
      `expected stderr deprecation notice for legacy "config" field; stderr:\n${result.stderr}`,
    );
    assert.match(result.stderr, /"rules"/);
    assert.match(result.stderr, /"extends"/);
  };
