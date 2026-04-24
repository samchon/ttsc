const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const workspaceRoot = path.resolve(__dirname, "../../..");

test("ttsc package entrypoints use built JavaScript output", () => {
  const packageJson = readPackageJson("ttsc");

  assert.equal(packageJson.main, "lib/index.js");
  assert.equal(packageJson.types, "lib/index.d.ts");
  assert.deepEqual(packageJson.exports["."], {
    types: "./lib/index.d.ts",
    default: "./lib/index.js",
  });
  assert.equal(packageJson.publishConfig, undefined);
});

test("ttsc package owns both compiler and runtime commands", () => {
  const packageJson = readPackageJson("ttsc");
  assert.deepEqual(packageJson.bin, {
    ttsc: "lib/launcher/ttsc.js",
    ttsx: "lib/launcher/ttsx.js",
  });
});

test("ttsc exposes plugin helpers through the root package only", () => {
  const packageJson = readPackageJson("ttsc");
  assert.equal(packageJson.exports["./plugin"], undefined);
  assert.equal(
    fs.existsSync(path.join(workspaceRoot, "packages", "ttsc", "src", "plugin.ts")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(workspaceRoot, "packages", "ttsc", "src", "index.ts")),
    true,
  );
});

test("published package file lists keep TypeScript and Go sources", () => {
  const ttsc = readPackageJson("ttsc");
  for (const entry of [
    "cmd",
    "driver",
    "shim",
    "src",
    "test",
    "tools",
    "go.mod",
    "go.sum",
  ]) {
    assert.equal(
      ttsc.files.includes(entry),
      true,
      `ttsc files must include ${entry}`,
    );
  }
  for (const entry of ["native", "node_modules", "THIRD-PARTY-LICENSES.md"]) {
    assert.equal(
      ttsc.files.includes(entry),
      false,
      `ttsc files must not include ${entry}`,
    );
  }
  assert.equal(ttsc.files.includes("tsconfig.json"), false);
  assert.equal(fs.existsSync(path.join(workspaceRoot, "packages", "ttsx")), false);
});

test("platform package matrix follows the TypeScript-Go native package shape", () => {
  const packageJson = readPackageJson("ttsc");
  const expected = {
    "ttsc-linux-x64": ["@ttsc/linux-x64", "linux", "x64"],
    "ttsc-linux-arm": ["@ttsc/linux-arm", "linux", "arm"],
    "ttsc-linux-arm64": ["@ttsc/linux-arm64", "linux", "arm64"],
    "ttsc-darwin-x64": ["@ttsc/darwin-x64", "darwin", "x64"],
    "ttsc-darwin-arm64": ["@ttsc/darwin-arm64", "darwin", "arm64"],
    "ttsc-win32-x64": ["@ttsc/win32-x64", "win32", "x64"],
    "ttsc-win32-arm64": ["@ttsc/win32-arm64", "win32", "arm64"],
  };

  assert.deepEqual(
    Object.keys(packageJson.optionalDependencies).sort(),
    Object.values(expected)
      .map(([name]) => name)
      .sort(),
  );

  for (const [directory, [name, os, cpu]] of Object.entries(expected)) {
    const platformJson = readPackageJson(directory);
    assert.equal(platformJson.name, name);
    assert.deepEqual(platformJson.os, [os]);
    assert.deepEqual(platformJson.cpu, [cpu]);
    assert.deepEqual(platformJson.files, ["bin", "package.json", "README.md"]);
    assert.equal(platformJson.scripts.build, "node ../../scripts/build-platform-package.cjs");
    assert.equal(platformJson.scripts.prepack, "pnpm run build");
  }
});

function readPackageJson(directory) {
  return JSON.parse(
    fs.readFileSync(
      path.join(workspaceRoot, "packages", directory, "package.json"),
      "utf8",
    ),
  );
}
