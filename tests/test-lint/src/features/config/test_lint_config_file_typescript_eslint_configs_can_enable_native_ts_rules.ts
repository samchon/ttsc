import {
  SOURCE_WITH_TS_ESLINT_VIOLATIONS,
  assert,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies that rules prefixed `@typescript-eslint/` in a `tseslint.config()`
 * call are forwarded to the native engine when their short name matches a
 * native rule.
 *
 * Pins the namespace-stripping pass in the Go-side config reducer. The test
 * uses a lightweight stub of `typescript-eslint` in `node_modules/` rather than
 * the real package so the test is hermetic. The stub's `recommended` preset
 * sets `no-var: warn` and `@typescript-eslint/no-explicit-any: warn`; the outer
 * config overrides the latter to `error`. After stripping the
 * `@typescript-eslint/` prefix, `no-explicit-any` must fire through the native
 * `no-explicit-any` rule.
 *
 * 1. Materialise a fixture with a stub `typescript-eslint` package and a
 *    `tseslint.config(...)` that uses `extends:
 *    [tseslint.configs.recommended]`.
 * 2. Run ttsc on source with a `var` declaration, `any`, and `console.log`.
 * 3. Assert `no-var: warn`, `no-explicit-any: error`, and `no-console: warn` all
 *    fire via the native engine.
 */
export const test_lint_config_file_typescript_eslint_configs_can_enable_native_ts_rules =
  () => {
    const result = runLint({
      name: "config-file-typescript-eslint",
      source: SOURCE_WITH_TS_ESLINT_VIOLATIONS,
      pluginConfig: {
        config: "./eslint.config.ts",
      },
      extraSources: {
        "eslint.config.ts": `import tseslint from "typescript-eslint";

      export default tseslint.config(
        {
          extends: [tseslint.configs.recommended],
          rules: {
            "@typescript-eslint/no-explicit-any": ["error", { fixToUnknown: true }],
          },
        },
        {
          files: ["src/**/*.ts"],
          rules: {
            "no-console": "warn",
          },
        },
      );\n`,
        "node_modules/typescript-eslint/package.json": JSON.stringify({
          type: "module",
          exports: "./index.js",
          types: "./index.d.ts",
        }),
        "node_modules/typescript-eslint/index.js": `export default {
        configs: {
          recommended: [
            {
              rules: {
                "no-var": "warn",
                "no-console": "off",
                "@typescript-eslint/no-explicit-any": "warn",
              },
            },
          ],
        },
        config: (...configs) => {
          const plugin = {};
          plugin.self = plugin;
          return configs.flat();
        },
      };\n`,
        "node_modules/typescript-eslint/index.d.ts": `declare const tseslint: {
        configs: {
          recommended: unknown[];
        };
        config: (...configs: unknown[]) => unknown[];
      };
      export default tseslint;\n`,
      },
    });

    assert.notEqual(result.status, 0);
    assert.deepEqual(
      result.diagnostics.map((d) => [d.rule, d.severity]),
      [
        ["no-var", "warn"],
        ["no-explicit-any", "error"],
        ["no-console", "warn"],
      ],
      result.stderr,
    );
  };
