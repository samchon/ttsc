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
  assert.equal(descriptor.native.mode, "ttsc-lint");
  assert.equal(descriptor.native.contractVersion, 1);
  assert.deepEqual(descriptor.native.capabilities, ["check"]);
});

test("native.source points at the bundled plugin sources", () => {
  const factory = loadFactory();
  const descriptor = factory(factoryContext({ transform: "@ttsc/lint" }));
  assert.equal(descriptor.native.source.dir, goSourceDir);
  assert.equal(descriptor.native.source.entry, "./plugin");
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
  assert.equal(a.native.mode, b.native.mode);
  assert.equal(a.native.contractVersion, b.native.contractVersion);
  assert.equal(a.native.source.dir, b.native.source.dir);
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
  const dts = fs.readFileSync(path.join(lintPkgDir, "lib", "index.d.ts"), "utf8");
  const configDts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "structures", "ITtscLintConfig.d.ts"),
    "utf8",
  );
  const ruleDts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "structures", "ITtscLintRule.d.ts"),
    "utf8",
  );
  const severityDts = fs.readFileSync(
    path.join(lintPkgDir, "lib", "structures", "ITtscLintSeverity.d.ts"),
    "utf8",
  );
  assert.match(dts, /import type { ITtscLintConfig }/);
  assert.match(dts, /import type {[\s\S]*ITtscPlugin[\s\S]*} from "ttsc"/);
  assert.match(dts, /ITtscLintPluginConfig = ITtscProjectPluginConfig/);
  assert.doesNotMatch(dts, /export type ITtscLintConfig/);
  assert.doesNotMatch(dts, /export type TtscLintRuleName/);
  assert.doesNotMatch(dts, /TtscLintPluginFactoryContext/);
  assert.doesNotMatch(dts, /TtscLintPluginDescriptor/);
  assert.doesNotMatch(dts, /ITtscNativeSource/);
  assert.doesNotMatch(dts, /configFile/);
  assert.doesNotMatch(dts, /configPath/);
  assert.doesNotMatch(dts, /rules\?:/);
  assert.match(configDts, /export type ITtscLintConfig/);
  assert.match(ruleDts, /export type ITtscLintRule/);
  assert.match(severityDts, /export type ITtscLintSeverity/);
  assert.doesNotMatch(dts, /defineConfig/);
});
