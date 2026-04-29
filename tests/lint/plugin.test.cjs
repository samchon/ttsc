// JS-side tests for the @ttsc/lint plugin descriptor.
//
// These checks pin the contract between the JS plugin descriptor and
// the ttsc plugin host. The rule corpus is exercised end-to-end by
// `cases.test.cjs`; engine + config sanity by `go-plugin/`.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const lintPkgDir = path.resolve(__dirname, "..", "..", "packages", "lint");
const pluginPath = path.join(lintPkgDir, "index.cjs");
const goPluginDir = path.join(lintPkgDir, "go-plugin");

test("index.cjs is a factory that returns a native source descriptor", () => {
  const factory = require(pluginPath);
  assert.equal(typeof factory, "function");
  const descriptor = factory({ name: "@ttsc/lint" }, {});
  assert.equal(descriptor.name, "@ttsc/lint");
  assert.equal(descriptor.native.mode, "ttsc-lint");
  assert.equal(descriptor.native.contractVersion, 1);
  assert.deepEqual(descriptor.native.capabilities, ["check"]);
});

test("native.source.dir points at the bundled go-plugin sources", () => {
  const factory = require(pluginPath);
  const descriptor = factory({ name: "@ttsc/lint" }, {});
  assert.equal(descriptor.native.source.dir, goPluginDir);
  // The Go module file must exist; otherwise the source build will fail.
  assert.ok(
    fs.existsSync(path.join(goPluginDir, "go.mod")),
    "go-plugin/go.mod is missing",
  );
  assert.ok(
    fs.existsSync(path.join(goPluginDir, "main.go")),
    "go-plugin/main.go is missing",
  );
});

test("descriptor is independent of plugin entry config", () => {
  // The factory ignores its config arg today (rules are read on the
  // native side via --plugins-json). Calling with arbitrary input should
  // still produce a stable descriptor.
  const factory = require(pluginPath);
  const a = factory({ name: "x", rules: { "no-var": "error" } }, {});
  const b = factory({ name: "y", rules: {} }, {});
  assert.equal(a.native.mode, b.native.mode);
  assert.equal(a.native.contractVersion, b.native.contractVersion);
  assert.equal(a.native.source.dir, b.native.source.dir);
});

test("package.json declares the deprecation handover plan", () => {
  const pkg = require(path.join(lintPkgDir, "package.json"));
  assert.equal(pkg.name, "@ttsc/lint");
  assert.equal(typeof pkg.deprecation, "object");
  assert.equal(pkg.deprecation.preferred, "@typescript-eslint/eslint-plugin");
  assert.match(pkg.deprecation.rationale, /reference implementation|preferred outcome|@typescript-eslint/);
});
