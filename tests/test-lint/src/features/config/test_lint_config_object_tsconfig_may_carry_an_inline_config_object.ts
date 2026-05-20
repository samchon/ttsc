import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies that the legacy `config` field on a tsconfig plugin entry accepts an
 * inline rules object and applies it correctly.
 *
 * Pins the legacy inline-object branch that must remain functional for backward
 * compatibility. Unlike the new `rules` field, the legacy `config` field may
 * carry a bare rules map directly in tsconfig.json without a separate file.
 * This test exercises that code path in isolation from the deprecation-warning
 * behaviour (which is covered separately).
 *
 * 1. Materialise a fixture whose plugin entry sets `config: { "no-console":
 *    "error", "no-var": "off" }`.
 * 2. Run ttsc; assert `no-console` fires and `no-var` does not.
 */
export const test_lint_config_object_tsconfig_may_carry_an_inline_config_object =
  () => {
    const result = runLint({
      name: "config-inline-object",
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
  };
