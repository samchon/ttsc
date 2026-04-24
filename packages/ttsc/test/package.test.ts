const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "../../..");

test("package metadata separates monorepo source exports from publish exports", () => {
  for (const packageName of ["ttsc", "ttsx"]) {
    const packageJson = readPackageJson(packageName);
    assert.match(packageJson.main, /^src\/.+\.ts$/);
    assert.match(packageJson.types, /^src\/.+\.ts$/);
    assert.equal(packageJson.exports["."].types, "./src/index.ts");
    assert.equal(packageJson.publishConfig.main, "lib/index.js");
    assert.equal(packageJson.publishConfig.types, "lib/index.d.ts");
    assert.equal(
      packageJson.publishConfig.exports["."].types,
      "./lib/index.d.ts",
    );
    assert.equal(
      packageJson.publishConfig.exports["."].default,
      "./lib/index.js",
    );
  }
});

test("ttsc plugin subpath also separates source and publish declarations", () => {
  const packageJson = readPackageJson("ttsc");
  assert.equal(packageJson.exports["./plugin"].types, "./src/plugin.ts");
  assert.equal(packageJson.exports["./plugin"].default, "./lib/plugin.js");
  assert.equal(
    packageJson.publishConfig.exports["./plugin"].types,
    "./lib/plugin.d.ts",
  );
  assert.equal(
    packageJson.publishConfig.exports["./plugin"].default,
    "./lib/plugin.js",
  );
});

test("ttsc declares platform packages as optional dependencies", () => {
  const packageJson = readPackageJson("ttsc");
  const expected = [
    "@ttsc/linux-x64",
    "@ttsc/linux-arm64",
    "@ttsc/darwin-x64",
    "@ttsc/darwin-arm64",
    "@ttsc/win32-x64",
    "@ttsc/win32-arm64",
  ];

  assert.deepEqual(
    Object.keys(packageJson.optionalDependencies).sort(),
    expected.toSorted(),
  );
  for (const name of expected) {
    assert.equal(packageJson.optionalDependencies[name], "workspace:*");
  }
  assert.equal(packageJson.files.includes("native"), false);
});

test("platform packages expose os cpu constrained native binaries", () => {
  const matrix = {
    "ttsc-linux-x64": ["@ttsc/linux-x64", "linux", "x64", "Linux x64"],
    "ttsc-linux-arm64": ["@ttsc/linux-arm64", "linux", "arm64", "Linux arm64"],
    "ttsc-darwin-x64": ["@ttsc/darwin-x64", "darwin", "x64", "macOS x64"],
    "ttsc-darwin-arm64": ["@ttsc/darwin-arm64", "darwin", "arm64", "macOS arm64"],
    "ttsc-win32-x64": ["@ttsc/win32-x64", "win32", "x64", "Windows x64"],
    "ttsc-win32-arm64": ["@ttsc/win32-arm64", "win32", "arm64", "Windows arm64"],
  };

  for (const [dir, [name, os, cpu, label]] of Object.entries(matrix)) {
    const packageJson = readPackageJson(dir);
    assert.equal(packageJson.name, name);
    assert.deepEqual(packageJson.os, [os]);
    assert.deepEqual(packageJson.cpu, [cpu]);
    assert.deepEqual(packageJson.files, ["bin", "package.json"]);
    assert.equal(packageJson.scripts.build, "node ../../scripts/build-platform-package.cjs");
    assert.equal(packageJson.scripts.prepack, "pnpm run build");
    assert.equal(packageJson.description.includes(label), true);
  }
});

function readPackageJson(packageName) {
  return JSON.parse(
    fs.readFileSync(
      path.join(workspaceRoot, "packages", packageName, "package.json"),
      "utf8",
    ),
  );
}
