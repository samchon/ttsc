const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  readProjectConfig,
} = require("../lib/compiler/internal/project/readProjectConfig.js");
const {
  loadProjectPlugins,
} = require("../lib/plugin/internal/loadProjectPlugins.js");
const {
  resolveProjectConfig,
} = require("../lib/compiler/internal/project/resolveProjectConfig.js");

test("resolveProjectConfig canonicalizes symlinked tsconfig paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const real = path.join(root, "real");
  const link = path.join(root, "link");
  fs.mkdirSync(real, { recursive: true });
  fs.writeFileSync(path.join(real, "tsconfig.json"), "{}\n", "utf8");
  fs.symlinkSync(real, link, "dir");

  const resolved = resolveProjectConfig({
    tsconfig: path.join(link, "tsconfig.json"),
  });
  assert.equal(resolved, fs.realpathSync(path.join(real, "tsconfig.json")));
});

test("readProjectConfig inherits plugins and outDir through tsconfig extends", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(shared, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          outDir: "../dist/shared",
          plugins: [{ transform: "./plugins/example.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../config/tsconfig.json",
        compilerOptions: {},
      },
      null,
      2,
    ),
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(project, "tsconfig.json"),
  });
  assert.deepEqual(parsed.compilerOptions.plugins, [
    { transform: "./plugins/example.cjs" },
  ]);
  assert.deepEqual(parsed.pluginBaseDirs, [shared]);
  assert.equal(parsed.compilerOptions.outDir, path.join(root, "dist/shared"));
});

test("readProjectConfig applies array extends in order", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(shared, "base-a.json"),
    JSON.stringify(
      {
        compilerOptions: {
          outDir: "../dist/base-a",
          rootDir: "../src-a",
          plugins: [{ transform: "./plugins/base-a.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(shared, "base-b.json"),
    JSON.stringify(
      {
        compilerOptions: {
          outDir: "../dist/base-b",
          plugins: [{ transform: "./plugins/base-b.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        extends: ["../config/base-a.json", "../config/base-b.json"],
        compilerOptions: {
          declarationDir: "../types",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(project, "tsconfig.json"),
  });

  assert.equal(parsed.compilerOptions.outDir, path.join(root, "dist/base-b"));
  assert.equal(parsed.compilerOptions.rootDir, path.join(root, "src-a"));
  assert.equal(parsed.compilerOptions.declarationDir, path.join(root, "types"));
  assert.deepEqual(parsed.compilerOptions.plugins, [
    { transform: "./plugins/base-b.cjs" },
  ]);
  assert.deepEqual(parsed.pluginBaseDirs, [shared]);
});

test("readProjectConfig lets later array extends clear inherited plugins", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(shared, "base-a.json"),
    JSON.stringify(
      {
        compilerOptions: {
          plugins: [{ transform: "./plugins/base-a.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(shared, "base-b.json"),
    JSON.stringify(
      {
        compilerOptions: {
          plugins: [],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        extends: ["../config/base-a.json", "../config/base-b.json"],
      },
      null,
      2,
    ),
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(project, "tsconfig.json"),
  });

  assert.deepEqual(parsed.compilerOptions.plugins, []);
  assert.deepEqual(parsed.pluginBaseDirs, []);
});

test("readProjectConfig resolves inherited relative path options from the declaring file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(shared, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          baseUrl: "../shared-base",
          rootDir: "../shared-src",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify({ extends: "../config/tsconfig.json" }, null, 2),
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(project, "tsconfig.json"),
  });

  assert.equal(parsed.compilerOptions.baseUrl, path.join(root, "shared-base"));
  assert.equal(parsed.compilerOptions.rootDir, path.join(root, "shared-src"));
});

test("loadProjectPlugins resolves inherited relative transform paths from the declaring file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(path.join(shared, "plugins"), { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(shared, "plugins", "base.cjs"),
    `module.exports = { name: "base-relative", source: "" };\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(shared, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          plugins: [{ transform: "./plugins/base.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify({ extends: "../config/tsconfig.json" }, null, 2),
    "utf8",
  );

  assert.throws(
    () =>
      loadProjectPlugins({
        binary: "",
        tsconfig: path.join(project, "tsconfig.json"),
      }),
    /must declare source/,
  );
});

test("loadProjectPlugins suppresses package auto plugin through symlinked explicit path", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const realPackage = path.join(root, "packages", "linked-plugin");
  const project = path.join(root, "project");
  const linkedPackage = path.join(project, "node_modules", "linked-plugin");
  fs.mkdirSync(path.dirname(linkedPackage), { recursive: true });
  fs.mkdirSync(path.join(realPackage, "plugin-go"), { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.symlinkSync(realPackage, linkedPackage, "junction");
  fs.writeFileSync(
    path.join(project, "package.json"),
    JSON.stringify({
      private: true,
      devDependencies: {
        "linked-plugin": "0.0.0",
      },
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        plugins: [{ transform: "./node_modules/linked-plugin/index.cjs" }],
      },
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(realPackage, "package.json"),
    JSON.stringify({
      main: "index.cjs",
      name: "linked-plugin",
      ttsc: {
        plugin: {
          transform: "linked-plugin",
        },
      },
      version: "0.0.0",
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(realPackage, "index.cjs"),
    `module.exports = {
      name: "linked-plugin",
      source: ${JSON.stringify(path.join(realPackage, "plugin-go"))}
    };\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(realPackage, "plugin-go", "go.mod"),
    "module example.com/linkedplugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(realPackage, "plugin-go", "main.go"),
    "package main\n\nfunc main() {}\n",
    "utf8",
  );

  const loaded = loadProjectPlugins({
    binary: "",
    cacheDir: path.join(root, "cache"),
    cwd: project,
    tsconfig: path.join(project, "tsconfig.json"),
  });

  assert.equal(loaded.nativePlugins.length, 1);
});

test("readProjectConfig lets child tsconfig override inherited plugins", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const shared = path.join(root, "config");
  const project = path.join(root, "project");
  fs.mkdirSync(shared, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(shared, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          plugins: [{ transform: "./plugins/example.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "../config/tsconfig.json",
        compilerOptions: {
          plugins: [{ transform: "./local-plugin.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(project, "tsconfig.json"),
  });
  assert.deepEqual(parsed.compilerOptions.plugins, [
    { transform: "./local-plugin.cjs" },
  ]);
});

test("readProjectConfig resolves package tsconfig extends", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  const preset = path.join(root, "node_modules", "@scope", "tsconfig");
  const project = path.join(root, "project");
  fs.mkdirSync(preset, { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(preset, "base.json"),
    JSON.stringify(
      {
        compilerOptions: {
          outDir: "../../dist/preset",
          plugins: [{ transform: "./plugins/from-preset.cjs" }],
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    JSON.stringify(
      {
        extends: "@scope/tsconfig/base.json",
        compilerOptions: {},
      },
      null,
      2,
    ),
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(project, "tsconfig.json"),
  });
  assert.deepEqual(parsed.compilerOptions.plugins, [
    { transform: "./plugins/from-preset.cjs" },
  ]);
  assert.equal(
    parsed.compilerOptions.outDir,
    path.join(root, "node_modules", "dist", "preset"),
  );
});

test("readProjectConfig accepts JSONC comments and trailing commas", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    `{
      // plugin host configuration may live in JSONC tsconfig files
      "compilerOptions": {
        "plugins": [
          { "transform": "./plugins/jsonc.cjs" },
        ],
      },
    }\n`,
    "utf8",
  );

  const parsed = readProjectConfig({
    tsconfig: path.join(root, "tsconfig.json"),
  });
  assert.deepEqual(parsed.compilerOptions.plugins, [
    { transform: "./plugins/jsonc.cjs" },
  ]);
});

test("readProjectConfig rejects circular tsconfig extends", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-project-"));
  fs.writeFileSync(
    path.join(root, "a.json"),
    JSON.stringify({ extends: "./b.json" }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(root, "b.json"),
    JSON.stringify({ extends: "./a.json" }),
    "utf8",
  );

  assert.throws(
    () => readProjectConfig({ tsconfig: path.join(root, "a.json") }),
    /circular tsconfig extends detected/,
  );
});
