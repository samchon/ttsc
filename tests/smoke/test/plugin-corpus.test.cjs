const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  commonJsProject,
  spawn,
  ttscBin,
} = require("./_helpers.cjs");

function pluginProject(pluginEntries, pluginFiles) {
  return commonJsProject(
    {
      ...pluginFiles,
      "src/main.ts": `export const value: string = "plugin";\n`,
    },
    {
      compilerOptions: {
        plugins: pluginEntries,
      },
    },
  );
}

test("plugin corpus: default export factory is accepted", () => {
  const root = pluginProject(
    [{ transform: "./plugins/default.cjs", label: "default-shape" }],
    {
      "plugins/default.cjs": `
        exports.default = (config) => ({
          name: "default-export",
          transformOutput(context) {
            return context.code + "\\n// " + config.label + ":" + context.command;
          },
        });
      `,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.equal(result.status, 0, result.stderr);
  assert.match(
    fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
    /\/\/ default-shape:build\s*$/,
  );
});

test("plugin corpus: createTtscPlugin export is accepted", () => {
  const root = pluginProject(
    [{ transform: "./plugins/create.cjs" }],
    {
      "plugins/create.cjs": `
        exports.createTtscPlugin = () => ({
          name: "create-export",
          transformOutput(context) {
            return "// create:" + context.command + "\\n" + context.code;
          },
        });
      `,
    },
  );

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts"],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^\/\/ create:transform\n/);
});

test("plugin corpus: conflicting native modes fail before build", () => {
  const root = pluginProject(
    [
      { transform: "./plugins/a.cjs" },
      { transform: "./plugins/b.cjs" },
    ],
    {
      "plugins/a.cjs": `module.exports = { name: "a", native: { mode: "alpha" } };\n`,
      "plugins/b.cjs": `module.exports = { name: "b", native: { mode: "beta" } };\n`,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /multiple native plugin modes requested/);
});

test("plugin corpus: invalid plugin export reports the bad specifier", () => {
  const root = pluginProject(
    [{ transform: "./plugins/invalid.cjs" }],
    {
      "plugins/invalid.cjs": `module.exports = 123;\n`,
    },
  );

  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not export a valid ttsc plugin/);
});

test("plugin corpus: transform --out receives transformOutput text", () => {
  const root = pluginProject(
    [{ transform: "./plugins/out.cjs" }],
    {
      "plugins/out.cjs": `
        module.exports = {
          name: "out",
          transformOutput(context) {
            return context.code + "\\n// out:" + context.command;
          },
        };
      `,
    },
  );
  const output = path.join(root, "custom", "main.js");

  const result = spawn(
    ttscBin,
    ["transform", "--cwd", root, "--file", "src/main.ts", "--out", output],
    { cwd: root },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(output, "utf8"), /\/\/ out:transform\s*$/);
});
