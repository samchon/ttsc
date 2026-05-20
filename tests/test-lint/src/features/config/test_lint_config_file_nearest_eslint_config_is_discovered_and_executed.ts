import {
  assert,
  fakeEslintRuntimeModule,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies that `eslint.config.mjs` is auto-discovered and executed via the
 * ESLint runtime even when no explicit `config` field is set on the plugin
 * entry.
 *
 * Pins the config auto-discovery path. When the user does not provide a
 * `config` or `extends` value, the engine must walk up from the source file's
 * directory to find the nearest `eslint.config.*` and pass it to the runtime as
 * the `overrideConfigFile`. A missing discovery pass would silently skip all
 * ESLint rules in projects that rely on auto-discovery.
 *
 * 1. Materialise a fixture with an `eslint.config.mjs` in the project root and no
 *    explicit `config` field on the plugin entry.
 * 2. Run ttsc; assert the auto-discovered config's rule fires.
 */
export const test_lint_config_file_nearest_eslint_config_is_discovered_and_executed =
  () => {
    const result = runLint({
      name: "config-file-eslint-auto-discovery",
      source: `const promise = Promise.resolve(1);\nvoid promise;\n`,
      pluginConfig: {},
      extraSources: {
        "eslint.config.mjs": `export default [
        {
          extends: ["eslint/recommended"],
          plugins: {
            "@typescript-eslint": {},
          },
          rules: {
            "@typescript-eslint/no-floating-promises": "error",
          },
        },
      ];\n`,
        ...fakeEslintRuntimeModule(
          "@typescript-eslint/no-floating-promises",
          "Auto-discovered config executed.",
        ),
      },
    });

    assert.notEqual(result.status, 0);
    assert.equal(
      result.stderr.includes("@ttsc/lint: ignoring unknown rule"),
      false,
      result.stderr,
    );
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity, d.message]),
      [
        [
          "@typescript-eslint/no-floating-promises",
          "error",
          "Auto-discovered config executed.",
        ],
      ],
      result.stderr,
    );
  };
