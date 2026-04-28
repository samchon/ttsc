// JS-side tests for the @ttsc/lint plugin descriptor.
//
// The Go-side rule corpus has its own tests under
// packages/lint/go-plugin/lint. These checks pin the contract between the
// JS plugin descriptor and the ttsc plugin host.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const pluginPath = path.resolve(__dirname, "..", "plugin.cjs");
const goPluginDir = path.resolve(__dirname, "..", "go-plugin");

test("plugin.cjs is a factory that returns a native source descriptor", () => {
  const factory = require(pluginPath);
  assert.equal(typeof factory, "function");
  const descriptor = factory({ name: "@ttsc/lint" }, {});
  assert.equal(descriptor.name, "@ttsc/lint");
  assert.equal(descriptor.native.mode, "ttsc-lint");
  assert.equal(descriptor.native.contractVersion, 1);
  assert.deepEqual(descriptor.native.capabilities, ["check", "build", "transform"]);
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
  const pkg = require(path.resolve(__dirname, "..", "package.json"));
  assert.equal(pkg.name, "@ttsc/lint");
  assert.equal(typeof pkg.deprecation, "object");
  assert.equal(pkg.deprecation.preferred, "@typescript-eslint/eslint-plugin");
  assert.match(pkg.deprecation.rationale, /reference implementation|preferred outcome|@typescript-eslint/);
});
