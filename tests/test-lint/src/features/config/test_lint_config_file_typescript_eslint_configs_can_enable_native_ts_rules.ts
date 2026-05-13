import {
  SOURCE_WITH_TS_ESLINT_VIOLATIONS,
  assert,
  runLint,
} from "../../internal/config-file";

/**
 * Verifies lint config file: typescript-eslint configs can enable native TS
 * rules.
 *
 * This lint config scenario is isolated as one exported TypeScript feature so
 * failures identify the exact package contract under test without a shared
 * smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
