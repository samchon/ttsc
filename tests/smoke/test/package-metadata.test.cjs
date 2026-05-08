const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { workspaceRoot } = require("./_helpers.cjs");

const packagesRoot = path.join(workspaceRoot, "packages");

test("ttsc package metadata points publish consumers at built outputs", () => {
  const dir = path.join(packagesRoot, "ttsc");
  const manifest = readPackage(dir);

  assert.equal(manifest.main, "lib/index.js");
  assert.equal(manifest.types, "src/index.ts");
  assert.equal(manifest.publishConfig.main, "lib/index.js");
  assert.equal(manifest.publishConfig.types, "lib/index.d.ts");
  assert.equal(manifest.exports["."].types, "./src/index.ts");
  assert.equal(manifest.publishConfig.exports["."].types, "./lib/index.d.ts");
  assert.equal(manifest.publishConfig.exports["."].default, "./lib/index.js");
  assertPackagePathExists(dir, manifest.publishConfig.main);
  assertPackagePathExists(dir, manifest.publishConfig.types);
  assertPackagePathExists(dir, manifest.bin.ttsc);
  assertPackagePathExists(dir, manifest.bin.ttsx);
});

test("platform packages match ttsc optional dependency matrix", () => {
  const ttsc = readPackage(path.join(packagesRoot, "ttsc"));
  const optionalPlatformNames = Object.keys(ttsc.optionalDependencies)
    .filter((name) => name.startsWith("@ttsc/"))
    .sort();
  const platformDirs = fs
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ttsc-"))
    .map((entry) => path.join(packagesRoot, entry.name));
  const platformNames = platformDirs.map((dir) => readPackage(dir).name).sort();

  assert.deepEqual(optionalPlatformNames, platformNames);

  for (const dir of platformDirs) {
    const manifest = readPackage(dir);
    const match = /^@ttsc\/(linux|darwin|win32)-(x64|arm|arm64)$/.exec(
      manifest.name,
    );
    assert.ok(match, `invalid platform package name: ${manifest.name}`);
    assert.deepEqual(manifest.os, [match[1]]);
    assert.deepEqual(manifest.cpu, [match[2]]);
    assert.deepEqual(manifest.files, ["bin", "package.json", "README.md"]);
    assert.equal(manifest.publishConfig.access, "public");
    assert.equal(
      manifest.scripts.build,
      "node ../../scripts/build-platform-package.cjs",
    );
  }
});

test("first-party source plugin packages expose their host contract", () => {
  for (const name of ["banner", "paths", "strip", "lint"]) {
    const dir = path.join(packagesRoot, name);
    const manifest = readPackage(dir);

    assert.equal(manifest.ttsc.plugin.transform, manifest.name);
    assert.ok(
      manifest.files.includes("go.mod"),
      `${manifest.name} misses go.mod`,
    );
    assert.ok(
      manifest.files.includes("plugin"),
      `${manifest.name} misses plugin`,
    );
    assertPackagePathExists(dir, "go.mod");
    assertPackagePathExists(dir, "plugin/main.go");

    for (const value of exportFileTargets(manifest.exports["."])) {
      assertPackagePathExists(dir, value);
    }
  }
});

test("@ttsc/unplugin exports built JS and declaration files", () => {
  const dir = path.join(packagesRoot, "unplugin");
  const manifest = readPackage(dir);

  for (const [specifier, entry] of Object.entries(manifest.exports)) {
    if (specifier === "./package.json") {
      assert.equal(entry, "./package.json");
      continue;
    }
    assert.equal(entry.types.startsWith("./lib/"), true, specifier);
    assert.equal(entry.import.startsWith("./lib/"), true, specifier);
    assert.equal(entry.default.startsWith("./lib/"), true, specifier);
    assertPackagePathExists(dir, entry.types);
    assertPackagePathExists(dir, entry.import);
    assertPackagePathExists(dir, entry.default);
  }
});

function readPackage(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
}

function exportFileTargets(entry) {
  if (typeof entry === "string") {
    return [entry];
  }
  return Object.values(entry).filter((value) => typeof value === "string");
}

function assertPackagePathExists(dir, target) {
  assert.equal(
    fs.existsSync(path.join(dir, target.replace(/^\.\//, ""))),
    true,
    `${path.basename(dir)} package target is missing: ${target}`,
  );
}
