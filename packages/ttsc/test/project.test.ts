const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  readProjectConfig,
  resolveProjectConfig,
} = require("../src/project.ts");

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
  assert.equal(parsed.compilerOptions.outDir, path.join(root, "dist/shared"));
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
