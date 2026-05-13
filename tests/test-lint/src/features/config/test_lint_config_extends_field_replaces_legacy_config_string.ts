import { SOURCE, assert, runLint } from "../../internal/config-file";

/**
 * Verifies the `extends` field replaces the legacy `config` string form.
 *
 * Pins the canonical ESLint-flat-config-shaped `extends` key on a tsconfig
 * plugin entry: a relative file path should resolve from the tsconfig
 * directory, load the referenced lint config, and emit no deprecation notice
 * for the legacy `config` key. A regression that re-routed file-path inputs
 * back through the legacy path would lose this signal.
 *
 * 1. Materialize a fixture whose tsconfig plugin entry sets only `extends:
 *    "./ttsc-lint.config.ts"`.
 * 2. Add the referenced config file as an extra source.
 * 3. Run ttsc and assert the referenced file's rules fire with no deprecation
 *    notice for `"config"`.
 */
export const test_lint_config_extends_field_replaces_legacy_config_string =
  () => {
    const result = runLint({
      name: "config-extends-field",
      source: SOURCE,
      pluginConfig: {
        extends: "./ttsc-lint.config.ts",
      },
      extraSources: {
        "ttsc-lint.config.ts": `import type { TtscLintConfig } from "@ttsc/lint";

const config = {
  "no-var": "off",
  "no-console": "error",
} satisfies TtscLintConfig;

export default config;
`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [["no-console", "error"]],
      result.stderr,
    );
    assert.doesNotMatch(result.stderr, /"config" is deprecated/);
  };
