const assert = require("node:assert/strict");
const test = require("node:test");

const { runLint } = require("./helpers/runLint.cjs");

const source = `var value = 1;\nconsole.log(value);\n`;

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
