const assert = require("node:assert/strict");
const { createRequire } = require("node:module");
const path = require("node:path");
const test = require("node:test");

const {
  createLintProject,
  runLint,
  runLintProject,
} = require("./helpers/runLint.cjs");

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

async function runESLintDirect(tmpdir, configPath, files) {
  const requireFromProject = createRequire(path.join(tmpdir, "package.json"));
  const eslintModule = requireFromProject("eslint");
  const ESLintCtor =
    typeof eslintModule.loadESLint === "function"
      ? await eslintModule.loadESLint({ useFlatConfig: true })
      : (eslintModule.ESLint ??
        eslintModule.default?.ESLint ??
        eslintModule.default);
  const eslint = new ESLintCtor({
    cwd: tmpdir,
    overrideConfigFile: path.join(tmpdir, configPath),
    ignore: true,
    warnIgnored: false,
  });
  const results = await eslint.lintFiles(
    files.map((file) => path.join(tmpdir, file)),
  );
  return results.flatMap((result) =>
    result.messages.map((message) => ({
      file: path.relative(tmpdir, result.filePath).replaceAll(path.sep, "/"),
      line: message.line || 1,
      column: message.column || 1,
      severity: message.severity >= 2 ? "error" : "warn",
      rule: message.ruleId || "eslint",
      message: message.message,
    })),
  );
}

function diagnosticComparable(diagnostic) {
  return {
    file: diagnostic.file,
    line: diagnostic.line,
    column: diagnostic.column,
    severity: diagnostic.severity,
    rule: diagnostic.rule,
    message: diagnostic.message,
  };
}

async function assertESLintRuntimeParity(options, files = ["src/main.ts"]) {
  const project = createLintProject(options);
  try {
    const ttsc = runLintProject(project.tmpdir);
    const eslint = await runESLintDirect(
      project.tmpdir,
      "eslint.config.mjs",
      files,
    );

    assert.notEqual(ttsc.status, 0, ttsc.stderr);
    assert.deepEqual(
      ttsc.diagnostics.map(diagnosticComparable),
      eslint,
      ttsc.stderr,
    );
  } finally {
    project.cleanup();
  }
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

test("lint disable comments: native engine respects eslint and lint directives", () => {
  const result = runLint({
    name: "native-inline-disable-directives",
    source: `var before = 1;
// eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any -- deliberate
var skipped: any = 2;
var sameLine = 3; debugger; // lint-disable-line no-var, no-debugger
/* eslint-disable no-var */
var blockSkipped = 4;
/* eslint-enable no-var */
var after = 5;
const text = "// eslint-disable-next-line no-var";
var stringNotDirective = 6;
`,
    rules: {
      "no-var": "error",
      "no-debugger": "error",
      "no-explicit-any": "error",
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.line]),
    [
      ["no-var", 1],
      ["no-var", 8],
      ["no-var", 10],
    ],
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

test("lint config file: installed ESLint runtime executes real typescript-eslint RuleModules", () => {
  const result = runLint({
    name: "config-file-eslint-runtime-real-typescript-eslint",
    source: `const value: any = 1;\nconsole.log(value);\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config({
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-explicit-any": "error",
          "no-console": "off",
        },
      });\n`,
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.equal(
    result.stderr.includes("@ttsc/lint: ignoring unknown rule"),
    false,
    result.stderr,
  );
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity, d.message]),
    [
      [
        "@typescript-eslint/no-explicit-any",
        "error",
        "Unexpected any. Specify a different type.",
      ],
    ],
    result.stderr,
  );
});

test("lint config file: installed ESLint runtime executes typed typescript-eslint rules", () => {
  const result = runLint({
    name: "config-file-eslint-runtime-real-typescript-eslint-typed",
    source: `Promise.resolve(1);\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config({
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: import.meta.dirname,
          },
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-floating-promises": "error",
        },
      });\n`,
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.rule, d.severity]),
    [["@typescript-eslint/no-floating-promises", "error"]],
    result.stderr,
  );
  assert.match(result.diagnostics[0].message, /Promises must be awaited/);
});

test("lint config file: ESLint runtime diagnostics match ESLint API output", async () => {
  await assertESLintRuntimeParity({
    name: "config-file-eslint-runtime-parity",
    source: `const value: any = 1;\nPromise.resolve(value);\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config({
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: import.meta.dirname,
          },
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-explicit-any": "error",
          "@typescript-eslint/no-floating-promises": "error",
        },
      });\n`,
    },
  });
});

test("lint config file: ESLint runtime matches inline disable output", async () => {
  await assertESLintRuntimeParity({
    name: "config-file-eslint-runtime-inline-disable",
    source: `const reported: any = 1;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const skipped: any = reported;
`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config({
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
          parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: import.meta.dirname,
          },
        },
        plugins: {
          "@typescript-eslint": tseslint.plugin,
        },
        rules: {
          "@typescript-eslint/no-explicit-any": "error",
        },
      });\n`,
    },
  });
});

test("lint config file: ESLint runtime matches package shareable config output", async () => {
  await assertESLintRuntimeParity({
    name: "config-file-eslint-runtime-shareable-package",
    source: `const forbidden = 1;\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `import shared from "eslint-config-ttsc-parity";

      export default [shared];\n`,
      "node_modules/eslint-config-ttsc-parity/package.json": JSON.stringify({
        type: "module",
        exports: "./index.mjs",
      }),
      "node_modules/eslint-config-ttsc-parity/index.mjs": `import tseslint from "typescript-eslint";

      const plugin = {
        rules: {
          "no-forbidden-name": {
            meta: {
              type: "problem",
              messages: {
                bad: "Forbidden identifier from shareable config.",
              },
            },
            create(context) {
              return {
                Identifier(node) {
                  if (node.name === "forbidden") {
                    context.report({ node, messageId: "bad" });
                  }
                },
              };
            },
          },
        },
      };

      export default {
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          local: plugin,
        },
        rules: {
          "local/no-forbidden-name": "error",
        },
      };\n`,
    },
  });
});

test("lint config file: ESLint runtime matches custom plugin output", async () => {
  await assertESLintRuntimeParity({
    name: "config-file-eslint-runtime-custom-plugin",
    source: `const forbidden = 1;\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `import tseslint from "typescript-eslint";

      const plugin = {
        rules: {
          "no-forbidden-name": {
            meta: {
              type: "problem",
              schema: [
                {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                  },
                  additionalProperties: false,
                },
              ],
              messages: {
                bad: "Forbidden identifier from {{label}} via {{source}}.",
              },
            },
            create(context) {
              const label = context.options[0]?.label ?? "missing option";
              const source = context.settings.localSource ?? "missing setting";
              return {
                Identifier(node) {
                  if (node.name === "forbidden") {
                    context.report({
                      node,
                      messageId: "bad",
                      data: { label, source },
                    });
                  }
                },
              };
            },
          },
        },
      };

      export default [{
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          local: plugin,
        },
        settings: {
          localSource: "settings",
        },
        rules: {
          "local/no-forbidden-name": ["error", { label: "rule option" }],
        },
      }];\n`,
    },
  });
});

test("lint config file: ESLint runtime matches UTF-16 columns", async () => {
  await assertESLintRuntimeParity({
    name: "config-file-eslint-runtime-utf16-column",
    source: `const emoji = "😀"; forbidden();\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `import tseslint from "typescript-eslint";

      const plugin = {
        rules: {
          "no-forbidden-name": {
            meta: {
              type: "problem",
              messages: {
                bad: "Forbidden identifier after emoji.",
              },
            },
            create(context) {
              return {
                Identifier(node) {
                  if (node.name === "forbidden") {
                    context.report({ node, messageId: "bad" });
                  }
                },
              };
            },
          },
        },
      };

      export default [{
        files: ["src/**/*.ts"],
        languageOptions: {
          parser: tseslint.parser,
        },
        plugins: {
          local: plugin,
        },
        rules: {
          "local/no-forbidden-name": "error",
        },
      }];\n`,
    },
  });
});

test("lint config file: ESLint runtime matches processor output", async () => {
  await assertESLintRuntimeParity({
    name: "config-file-eslint-runtime-processor",
    source: `const forbidden = 1;\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `const plugin = {
        processors: {
          ts: {
            preprocess(text, filename) {
              return [{ text, filename }];
            },
            postprocess(messages) {
              return messages.flat();
            },
            supportsAutofix: true,
          },
        },
        rules: {
          "no-forbidden-name": {
            meta: {
              type: "problem",
              messages: {
                bad: "Forbidden identifier from processor.",
              },
            },
            create(context) {
              return {
                Identifier(node) {
                  if (node.name === "forbidden") {
                    context.report({ node, messageId: "bad" });
                  }
                },
              };
            },
          },
        },
      };

      export default [{
        files: ["src/**/*.ts"],
        plugins: {
          local: plugin,
        },
        processor: "local/ts",
        rules: {
          "local/no-forbidden-name": "error",
        },
      }];\n`,
    },
  });
});

test("lint config file: ESLint runtime matches linterOptions output", async () => {
  await assertESLintRuntimeParity({
    name: "config-file-eslint-runtime-linter-options",
    source: `/* eslint-disable no-console */\nconsole.log(1);\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "eslint.config.mjs": `export default [{
        files: ["src/**/*.ts"],
        linterOptions: {
          noInlineConfig: true,
        },
        rules: {
          "no-console": "error",
        },
      }];\n`,
    },
  });
});

test("lint config file: installed ESLint runtime respects ignored files silently", () => {
  const result = runLint({
    name: "config-file-eslint-runtime-ignored-files",
    source: `export const value: any = 1;\n`,
    pluginConfig: {
      config: "./eslint.config.mjs",
    },
    linkNodeModules: ["eslint", "typescript-eslint", "typescript"],
    extraSources: {
      "src/generated.ts": `export const generated: any = 1;\n`,
      "eslint.config.mjs": `import tseslint from "typescript-eslint";

      export default tseslint.config(
        {
          ignores: ["src/generated.ts"],
        },
        {
          files: ["src/**/*.ts"],
          languageOptions: {
            parser: tseslint.parser,
          },
          plugins: {
            "@typescript-eslint": tseslint.plugin,
          },
          rules: {
            "@typescript-eslint/no-explicit-any": "error",
          },
        },
      );\n`,
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.map((d) => [d.file, d.rule, d.severity]),
    [["src/main.ts", "@typescript-eslint/no-explicit-any", "error"]],
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

test("lint config file: missing ESLint runtime fails for runtime-only fields", () => {
  const result = runLint({
    name: "config-file-eslint-missing-runtime-plugin-required",
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

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ESLint runtime is required/);
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
