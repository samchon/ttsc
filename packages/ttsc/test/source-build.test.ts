const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  buildSourcePlugin,
  computeCacheKey,
} = require("../lib/plugin/internal/buildSourcePlugin.js");

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

test("computeCacheKey changes when overlay source changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const plugin = path.join(root, "plugin");
  const overlay = path.join(root, "overlay");
  fs.mkdirSync(plugin, { recursive: true });
  fs.mkdirSync(overlay, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
  fs.writeFileSync(
    path.join(overlay, "go.mod"),
    "module example.com/overlay\n\ngo 1.26\n",
    "utf8",
  );
  const overlayFile = path.join(overlay, "host.go");
  fs.writeFileSync(overlayFile, "package overlay\nconst Value = 1\n", "utf8");

  const first = computeCacheKey({
    dir: plugin,
    entry: ".",
    overlayDirs: [overlay],
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  fs.writeFileSync(overlayFile, "package overlay\nconst Value = 2\n", "utf8");
  const second = computeCacheKey({
    dir: plugin,
    entry: ".",
    overlayDirs: [overlay],
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(first, second);
});

test("computeCacheKey changes when embedded data changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(plugin, "main.go"),
    'package main\n\nimport _ "embed"\n\n//go:embed rules.json\nvar rules string\n',
    "utf8",
  );
  const data = path.join(plugin, "rules.json");
  fs.writeFileSync(data, '{"version":1}\n', "utf8");

  const first = computeCacheKey({
    dir: plugin,
    entry: ".",
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  fs.writeFileSync(data, '{"version":2}\n', "utf8");
  const second = computeCacheKey({
    dir: plugin,
    entry: ".",
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(first, second);
});

test("computeCacheKey changes when Go compiler identity changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");

  const first = computeCacheKey({
    dir: plugin,
    entry: ".",
    goBinary: "/opt/go-a/bin/go",
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });
  const second = computeCacheKey({
    dir: plugin,
    entry: ".",
    goBinary: "/opt/go-b/bin/go",
    ttscVersion: "1.0.0",
    tsgoVersion: "7.0.0-dev",
  });

  assert.notEqual(first, second);
});
