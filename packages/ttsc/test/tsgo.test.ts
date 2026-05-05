const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { resolveTsgo } = require("../lib/compiler/internal/resolveTsgo.js");

test("resolveTsgo accepts TTSC_TSGO_BINARY as an explicit compiler", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-tsgo-test-"));
  const binary = path.join(root, "tsgo");
  fs.writeFileSync(binary, "", "utf8");

  const resolved = resolveTsgo({
    env: { TTSC_TSGO_BINARY: binary },
  });

  assert.equal(resolved.binary, binary);
  assert.equal(resolved.version, "custom");
});

test("resolveTsgo resolves the consumer native-preview platform package", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-tsgo-test-"));
  const nativeRoot = path.join(
    root,
    "node_modules",
    "@typescript",
    "native-preview",
  );
  const platformRoot = path.join(
    root,
    "node_modules",
    "@typescript",
    `native-preview-${process.platform}-${process.arch}`,
  );
  fs.mkdirSync(nativeRoot, { recursive: true });
  fs.mkdirSync(path.join(platformRoot, "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(nativeRoot, "package.json"),
    JSON.stringify({
      name: "@typescript/native-preview",
      version: "7.0.0-dev.consumer",
      gitHead: "abc123",
    }),
    "utf8",
  );
  fs.writeFileSync(
    path.join(platformRoot, "package.json"),
    JSON.stringify({
      name: `@typescript/native-preview-${process.platform}-${process.arch}`,
      version: "7.0.0-dev.consumer",
    }),
    "utf8",
  );
  const binary = path.join(
    platformRoot,
    "lib",
    process.platform === "win32" ? "tsgo.exe" : "tsgo",
  );
  fs.writeFileSync(binary, "", "utf8");

  const resolved = resolveTsgo({
    cwd: root,
    env: {},
  });

  assert.equal(resolved.version, "7.0.0-dev.consumer");
  assert.equal(resolved.gitHead, "abc123");
  assert.equal(resolved.binary, binary);
});
