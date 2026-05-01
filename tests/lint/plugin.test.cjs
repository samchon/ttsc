// JS-side tests for the @ttsc/lint plugin descriptor.
//
// These checks pin the contract between the JS plugin descriptor and
// the ttsc plugin host. The rule corpus is exercised end-to-end by
// `cases.test.cjs`; engine + config sanity by `plugin/`.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const lintPkgDir = path.resolve(__dirname, "..", "..", "packages", "lint");
const pluginPath = path.join(lintPkgDir, "lib", "index.js");
const goSourceDir = lintPkgDir;
const goPluginDir = path.join(lintPkgDir, "plugin");

test("lib/index.js is a factory that returns a native source descriptor", () => {
  const factory = loadFactory();
  assert.equal(typeof factory, "function");
  const descriptor = factory(factoryContext({ transform: "@ttsc/lint" }));
  assert.equal(descriptor.name, "@ttsc/lint");
  assert.equal(descriptor.stage, "check");
});

test("source points at the bundled plugin command package", () => {
  const factory = loadFactory();
  const descriptor = factory(factoryContext({ transform: "@ttsc/lint" }));
  assert.equal(descriptor.source, goPluginDir);
  // The Go module file must exist; otherwise the source build will fail.
  assert.ok(
    fs.existsSync(path.join(goSourceDir, "go.mod")),
    "go.mod is missing",
  );
  assert.ok(
    fs.existsSync(path.join(goPluginDir, "main.go")),
    "plugin/main.go is missing",
  );
});

test("descriptor is independent of plugin entry config", () => {
  // The factory ignores context.plugin today (rules are read on the
  // native side via --plugins-json). Calling with arbitrary input should
  // still produce a stable descriptor.
  const factory = loadFactory();
  const a = factory(
    factoryContext({ transform: "x", config: { "no-var": "error" } }),
  );
  const b = factory(factoryContext({ transform: "y", config: {} }));
  assert.equal(a.stage, b.stage);
  assert.equal(a.source, b.source);
});

function loadFactory() {
  const mod = require(pluginPath);
  return mod.createTtscPlugin ?? mod.default ?? mod;
}

function factoryContext(plugin) {
  return {
    binary: "",
    cwd: process.cwd(),
    plugin,
    projectRoot: lintPkgDir,
    tsconfig: path.join(lintPkgDir, "tsconfig.json"),
  };
}

test("lib/index.d.ts exposes typed lint config files", () => {
  const dts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "index.d.ts"),
    "utf8",
  );
  const configDts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "structures", "TtscLintConfig.d.ts"),
    "utf8",
  );
  const pluginConfigDts = fs.readFileSync(
    path.join(
      lintPkgDir,
      "lib",
      "structures",
      "ITtscLintPluginConfig.d.ts",
    ),
    "utf8",
  );
  const structuresIndexDts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "structures", "index.d.ts"),
    "utf8",
  );
  const ruleDts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "structures", "TtscLintRule.d.ts"),
    "utf8",
  );
  const severityDts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "structures", "TtscLintSeverity.d.ts"),
    "utf8",
  );
  assert.match(dts, /export \* from "\.\/structures\/index"/);
  assert.match(dts, /import type {[\s\S]*ITtscPlugin[\s\S]*} from "ttsc"/);
  assert.match(pluginConfigDts, /import type { TtscLintConfig }/);
  assert.match(
    pluginConfigDts,
    /export interface ITtscLintPluginConfig extends ITtscProjectPluginConfig/,
  );
  assert.doesNotMatch(dts, /configFile/);
  assert.doesNotMatch(dts, /configPath/);
  assert.doesNotMatch(dts, /rules\?:/);
  assert.match(configDts, /export type TtscLintConfig/);
  assert.match(structuresIndexDts, /export \* from "\.\/ITtscLintPluginConfig"/);
  assert.match(structuresIndexDts, /export \* from "\.\/TtscLintConfig"/);
  assert.match(ruleDts, /export type TtscLintRule/);
  assert.match(severityDts, /export type TtscLintSeverity/);
  assert.doesNotMatch(dts, /defineConfig/);
});
