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

function readPackageJson(packageName) {
  return JSON.parse(
    fs.readFileSync(
      path.join(workspaceRoot, "packages", packageName, "package.json"),
      "utf8",
    ),
  );
}
