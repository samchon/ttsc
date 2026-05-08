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

test("computeCacheKey includes standard Go source directories", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");

  for (const dirName of ["vendor", "lib", "dist", "build"]) {
    const file = path.join(plugin, dirName, "helper.go");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `package ${dirName}\nconst Value = 1\n`, "utf8");

    const first = computeCacheKey({
      dir: plugin,
      entry: ".",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    fs.writeFileSync(file, `package ${dirName}\nconst Value = 2\n`, "utf8");
    const second = computeCacheKey({
      dir: plugin,
      entry: ".",
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });

    assert.notEqual(first, second, `${dirName} was excluded from the key`);
  }
});

test("buildSourcePlugin materializes standard Go source directories", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  const plugin = path.join(root, "plugin");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(
    path.join(plugin, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(plugin, "main.go"), "package main\n", "utf8");
  for (const file of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    fs.mkdirSync(path.dirname(path.join(plugin, file)), { recursive: true });
    fs.writeFileSync(path.join(plugin, file), "package main\n", "utf8");
  }

  const fakeGo = createFakeGoBinary(root);
  const previousGo = process.env.TTSC_GO_BINARY;
  process.env.TTSC_GO_BINARY = fakeGo;
  try {
    const binary = buildSourcePlugin({
      baseDir: root,
      cacheDir: path.join(root, "cache"),
      overlayDirs: [],
      pluginName: "standard-dirs",
      source: plugin,
      quiet: true,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    assert.equal(fs.existsSync(binary), true);
  } finally {
    if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
    else process.env.TTSC_GO_BINARY = previousGo;
  }
});

test("buildSourcePlugin supports project-root sources with local cache", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-source-plugin-"));
  fs.writeFileSync(
    path.join(root, "go.mod"),
    "module example.com/plugin\n\ngo 1.26\n",
    "utf8",
  );
  fs.writeFileSync(path.join(root, "main.go"), "package main\n", "utf8");
  for (const file of [
    "vendor/local/value.go",
    "lib/helper.go",
    "dist/generated.go",
    "build/generated.go",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), "package main\n", "utf8");
  }

  const fakeGo = createFakeGoBinary(root);
  const previousGo = process.env.TTSC_GO_BINARY;
  process.env.TTSC_GO_BINARY = fakeGo;
  try {
    const binary = buildSourcePlugin({
      baseDir: root,
      overlayDirs: [],
      pluginName: "project-root-source",
      source: root,
      quiet: true,
      ttscVersion: "1.0.0",
      tsgoVersion: "7.0.0-dev",
    });
    assert.equal(binary.startsWith(path.join(root, ".ttsc", "plugins")), true);
    assert.equal(fs.existsSync(binary), true);
  } finally {
    if (previousGo === undefined) delete process.env.TTSC_GO_BINARY;
    else process.env.TTSC_GO_BINARY = previousGo;
  }
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

function createFakeGoBinary(root: string): string {
  const script = path.join(root, "fake-go.cjs");
  fs.writeFileSync(
    script,
    [
      'const fs = require("node:fs");',
      'const path = require("node:path");',
      "const args = process.argv.slice(2);",
      'if (args[0] === "version") {',
      '  console.log("go version fake");',
      "  process.exit(0);",
      "}",
      'if (args[0] !== "build") {',
      '  console.error(`unexpected go command: ${args.join(" ")}`);',
      "  process.exit(1);",
      "}",
      "const required = [",
      '  "vendor/local/value.go",',
      '  "lib/helper.go",',
      '  "dist/generated.go",',
      '  "build/generated.go",',
      "];",
      "const missing = required.filter((file) =>",
      "  !fs.existsSync(path.join(process.cwd(), file)),",
      ");",
      "if (missing.length > 0) {",
      '  console.error(`missing copied source files: ${missing.join(", ")}`);',
      "  process.exit(1);",
      "}",
      'const outIndex = args.indexOf("-o");',
      "const out = outIndex >= 0 ? args[outIndex + 1] : null;",
      "if (!out) {",
      '  console.error("missing -o output path");',
      "  process.exit(1);",
      "}",
      "fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });",
      'fs.writeFileSync(out, "fake plugin binary\\n", "utf8");',
      "process.exit(0);",
      "",
    ].join("\n"),
    "utf8",
  );

  if (process.platform === "win32") {
    const command = path.join(root, "fake-go.cmd");
    fs.writeFileSync(
      command,
      `@echo off\r\n"${process.execPath}" "%~dp0fake-go.cjs" %*\r\n`,
      "utf8",
    );
    return command;
  }

  const command = path.join(root, "fake-go");
  fs.writeFileSync(
    command,
    `#!/bin/sh\nexec ${shellQuote(process.execPath)} ${shellQuote(script)} "$@"\n`,
    "utf8",
  );
  fs.chmodSync(command, 0o755);
  return command;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}
