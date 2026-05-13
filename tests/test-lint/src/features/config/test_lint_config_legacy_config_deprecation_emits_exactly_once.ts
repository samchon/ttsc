import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that the legacy `config` deprecation notice emits exactly once per
 * ttsc run.
 *
 * Pins the bug fixed alongside the `rules`/`extends` migration: both the JS
 * factory and the Go sidecar parse the tsconfig plugin entry's `config` key,
 * and both used to print the deprecation banner — so a user with a single
 * legacy entry saw the same warning twice per run. Silent regression here would
 * mean the warning starts double-printing again the moment someone re-adds an
 * emit in the JS factory.
 *
 * 1. Materialize a fixture that uses the legacy inline-object `config` form on the
 *    tsconfig plugin entry.
 * 2. Run ttsc; capture full stderr.
 * 3. Count `"config" is deprecated` occurrences and assert exactly 1.
 */
export const test_lint_config_legacy_config_deprecation_emits_exactly_once =
  () => {
    const result = runLint({
      name: "config-legacy-deprecation-once",
      source: SOURCE,
      pluginConfig: {
        config: { "no-var": "off", "no-console": "error" },
      },
    });

    assert.notEqual(result.status, 0, result.stderr);
    const occurrences =
      result.stderr.match(/"config" is deprecated/g)?.length ?? 0;
    assert.equal(
      occurrences,
      1,
      `expected exactly one deprecation notice; got ${occurrences}. stderr:\n${result.stderr}`,
    );
  };
