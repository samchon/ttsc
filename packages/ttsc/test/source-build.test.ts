const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildSourcePlugin,
} = require("../lib/api/internal/plugin/buildSourcePlugin.js");

test("buildSourcePlugin rejects a source outside a nearby Go module", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const source = path.join(root, "a", "b", "c", "d", "cmd");
  fs.mkdirSync(source, { recursive: true });

  assert.throws(
    () =>
      buildSourcePlugin({
        baseDir: root,
        pluginName: "missing-go-mod",
        source,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      }),
    /go\.mod within 3 parent directories/,
  );
});

test("buildSourcePlugin rejects non-directory and non-go.mod sources", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const source = path.join(root, "plugin.txt");
  fs.writeFileSync(source, "not a Go package\n", "utf8");

  assert.throws(
    () =>
      buildSourcePlugin({
        baseDir: root,
        pluginName: "bad-source",
        source,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      }),
    /Go package directory or go\.mod file/,
  );
});
