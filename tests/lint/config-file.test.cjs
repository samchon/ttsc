const assert = require("node:assert/strict");
const test = require("node:test");

const { runLint } = require("./helpers/runLint.cjs");

const source = `var value = 1;\nconsole.log(value);\n`;
const sourceWithTsEslintViolations = `var value = 1;\nlet typed: any = value;\nconsole.log(typed);\n`;

function fakeEslintRuntimeModule(ruleId, message) {
  return {
    "node_modules/eslint/package.json": JSON.stringify({
      type: "commonjs",
      main: "./index.cjs",
    }),
    "node_modules/eslint/index.cjs": `const path = require("node:path");

    class ESLint {
      constructor(options) {
        this.options = options;
      }
      async lintFiles(files) {
        return files.map((filePath) => ({
          filePath: path.resolve(filePath),
          messages: [
            {
              ruleId: ${JSON.stringify(ruleId)},
              severity: 2,
              message: ${JSON.stringify(message)},
              line: 1,
              column: 7,
              endLine: 1,
              endColumn: 14,
            },
          ],
        }));
      }
    }

    module.exports = {
      ESLint,
      loadESLint: async () => ESLint,
    };\n`,
  };
}

test("lint config file: tsconfig may reference a standalone JSON file", () => {
  const result = runLint({
    name: "config-file-json",
    source,
    pluginConfig: {
      config: "./ttsc-lint.config.json",
    },
    extraSources: {
      "ttsc-lint.config.json": JSON.stringify({
        "no-var": "error",
      }),
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-var", "error"]],
    result.stderr,
  );
});

test("lint config file: JavaScript configs may export the rules object", () => {
  const result = runLint({
    name: "config-file-js",
    source,
    pluginConfig: {
      config: "./ttsc-lint.config.cjs",
    },
    extraSources: {
      "ttsc-lint.config.cjs": `module.exports = {
        "no-console": "warning",
      };\n`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-console", "warn"]],
    result.stderr,
  );
});

test("lint config file: ESM JavaScript configs may default-export the rules object", () => {
  const result = runLint({
    name: "config-file-mjs",
    source,
    pluginConfig: {
      config: "./ttsc-lint.config.mjs",
    },
    extraSources: {
      "ttsc-lint.config.mjs": `export default {
        "no-var": "error",
      };\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-var", "error"]],
    result.stderr,
  );
});

test("lint config file: TypeScript configs may default-export the rules object", () => {
  const result = runLint({
    name: "config-file-ts",
    source,
    pluginConfig: {
      config: "./ttsc-lint.config.ts",
    },
    extraSources: {
      "ttsc-lint.config.ts": `export default {
        "no-var": "error",
        "no-console": "off",
      };\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-var", "error"]],
    result.stderr,
  );
});

test("lint config file: TypeScript configs can use exported @ttsc/lint types", () => {
  const result = runLint({
    name: "config-file-ts-satisfies-native-type",
    source,
    pluginConfig: {
      config: "./ttsc-lint.config.ts",
    },
    extraSources: {
      "ttsc-lint.config.ts": `import type { TtscLintConfig } from "@ttsc/lint/config";

      const config = {
        "no-var": "error",
        "no-console": "off",
      } satisfies TtscLintConfig;

      export default config;\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-var", "error"]],
    result.stderr,
  );
});

test("lint config file: .cts configs load through ttsx", () => {
  const result = runLint({
    name: "config-file-cts",
    source,
    pluginConfig: {
      config: "./ttsc-lint.config.cts",
    },
    extraSources: {
      "ttsc-lint.config.cts": `const config = {
        "no-console": "error",
      };

      export = config;\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-console", "error"]],
    result.stderr,
  );
});

test("lint config file: .mts configs load through ttsx", () => {
  const result = runLint({
    name: "config-file-mts",
    source,
    pluginConfig: {
      config: "./ttsc-lint.config.mts",
    },
    extraSources: {
      "ttsc-lint.config.mts": `export default {
        "no-var": "error",
      };\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-var", "error"]],
    result.stderr,
  );
});

test("lint config file: ESLint flat config arrays are reduced to rules maps", () => {
  const result = runLint({
    name: "config-file-eslint-flat-array",
    source,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    extraSources: {
      "eslint.config.mjs": `export default [
        {
          rules: {
            "no-var": "off",
            "no-console": "warn",
          },
        },
        {
          files: ["src/**/*.ts"],
          rules: {
            "no-var": ["error", { ignore: true }],
            "no-console": "off",
          },
        },
      ];\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-var", "error"]],
    result.stderr,
  );
});

test("lint config file: ESLint files and ignores are resolved per source file", () => {
  const result = runLint({
    name: "config-file-eslint-files-ignores",
    source,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    extraSources: {
      "src/example.test.ts": source,
      "src/generated.ts": source,
      "eslint.config.mjs": `export default [
        {
          rules: {
            "no-var": "error",
            "no-console": "error",
          },
        },
        {
          files: ["src/**/*.test.ts"],
          rules: {
            "no-console": "off",
          },
        },
        {
          ignores: ["src/generated.ts"],
        },
      ];\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.file, d.rule, d.severity]).sort(),
    [
      ["src/example.test.ts", "no-var", "error"],
      ["src/main.ts", "no-console", "error"],
      ["src/main.ts", "no-var", "error"],
    ],
    result.stderr,
  );
});

test("lint config file: ESLint config extends are reduced before local rules", () => {
  const result = runLint({
    name: "config-file-eslint-extends",
    source,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    extraSources: {
      "eslint.config.mjs": `export default {
        extends: [
          {
            rules: {
              "no-var": "warn",
              "no-console": "error",
            },
          },
          [
            {
              rules: {
                "no-console": "off",
              },
            },
          ],
        ],
        rules: {
          "no-var": "error",
        },
      };\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["no-var", "error"]],
    result.stderr,
  );
});

test("lint config file: typescript-eslint configs can enable native TS rules", () => {
  const result = runLint({
    name: "config-file-typescript-eslint",
    source: sourceWithTsEslintViolations,
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
          return configs.flat().map((config) => ({
            ...config,
            plugins: { "@typescript-eslint": plugin },
            languageOptions: { parser: plugin },
          }));
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
});

test("lint config file: installed ESLint runtime executes external RuleModules", () => {
  const result = runLint({
    name: "config-file-eslint-runtime",
    source: `const promise = Promise.resolve(1);\nvoid promise;\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    extraSources: {
      "eslint.config.mjs": `export default [
        {
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
        "Promises must be awaited.",
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
        "Promises must be awaited.",
      ],
    ],
    result.stderr,
  );
});

test("lint config file: missing ESLint runtime falls back with unknown-rule warnings", () => {
  const result = runLint({
    name: "config-file-eslint-missing-runtime-fallback-warning",
    source: `const promise = Promise.resolve(1);\nvoid promise;\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    extraSources: {
      "eslint.config.mjs": `export default [
        {
          plugins: {
            "@typescript-eslint": {},
          },
          rules: {
            "@typescript-eslint/no-floating-promises": "error",
          },
        },
      ];\n`,
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.diagnostics.length, 0, result.stderr);
  assert.match(
    result.stderr,
    /@ttsc\/lint: ignoring unknown rule "no-floating-promises"/,
  );
});

test("lint config file: missing ESLint runtime fails for string extends", () => {
  const result = runLint({
    name: "config-file-eslint-missing-runtime-string-extends",
    source,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    extraSources: {
      "eslint.config.mjs": `export default [
        {
          extends: ["eslint/recommended"],
          rules: {
            "no-var": "error",
          },
        },
      ];\n`,
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ESLint runtime is required/);
});

test("lint config file: nearest eslint.config is discovered and executed", () => {
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
});

test("lint config object: tsconfig may carry an inline config object", () => {
  const result = runLint({
    name: "config-inline-object",
    source,
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
});
