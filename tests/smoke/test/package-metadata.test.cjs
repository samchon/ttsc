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

test("workspace build packages every platform toolchain", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(workspaceRoot, "package.json"), "utf8"),
  );
  assert.equal(packageJson.scripts.build, "node scripts/build-platforms.cjs");
  assert.equal(packageJson.scripts["build:current"], "node scripts/build-current.cjs");
  assert.equal(
    packageJson.scripts["package:latest"],
    "pnpm build && pnpm --filter=./packages/* -r publish --tag latest --access public",
  );
  assert.equal(packageJson.scripts.release, "pnpm build && bumpp -r");
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

test("utility plugin packages own their native sources", () => {
  const expectations = {
    banner: { capabilities: ["output"], mode: "ttsc-banner" },
    lint: { capabilities: ["check"], mode: "ttsc-lint" },
    paths: { capabilities: ["output"], mode: "ttsc-paths" },
    strip: { capabilities: ["output"], mode: "ttsc-strip" },
  };
  for (const [directory, expectation] of Object.entries(expectations)) {
    const packageJson = readPackageJson(directory);
    assert.equal(packageJson.main, "src/index.cjs");
    assert.equal(packageJson.exports["."], "./src/index.cjs");
    assert.deepEqual(packageJson.files, [
      "README.md",
      "src/index.cjs",
      "go.mod",
      "plugin",
    ]);
    assert.equal(
      fs.existsSync(path.join(workspaceRoot, "packages", directory, "go.mod")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(workspaceRoot, "packages", directory, "go-plugin")),
      false,
    );
    assert.equal(
      listPackageGoArtifacts(path.join(workspaceRoot, "packages", directory))
        .some((file) => file.endsWith("go.work") || file.endsWith("go.work.sum")),
      false,
    );
    assert.equal(
      listPackageGoArtifacts(path.join(workspaceRoot, "packages", directory, "plugin"))
        .some((file) => file.endsWith("_test.go")),
      false,
    );
    assert.equal(packageJson.dependencies?.["@ttsc/lint"], undefined);
    const factory = require(path.join(workspaceRoot, "packages", directory));
    const descriptor = factory({}, {});
    assert.equal(descriptor.native.mode, expectation.mode);
    assert.deepEqual(descriptor.native.capabilities, expectation.capabilities);
    assert.equal(
      descriptor.native.source.dir,
      path.join(workspaceRoot, "packages", directory),
    );
    assert.equal(descriptor.native.source.entry, "./plugin");
  }
});

test("platform package matrix follows the ttsc helper package shape", () => {
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
    assert.match(platformJson.description, /bundled Go compiler/);
    assert.deepEqual(platformJson.os, [os]);
    assert.deepEqual(platformJson.cpu, [cpu]);
    assert.deepEqual(platformJson.files, ["bin", "package.json", "README.md"]);
    assert.equal(platformJson.scripts.build, "node ../../scripts/build-platform-package.cjs");
    assert.equal(platformJson.scripts.prepack, undefined);
  }
});

test("next publish bumps versions before a single workspace build", () => {
  const script = fs.readFileSync(path.join(workspaceRoot, "next.bash"), "utf8");
  assert.match(script, /pnpm bumpp "\$1"/);
  assert.match(script, /pnpm build/);
  assert.match(script, /pnpm --filter=\.\/packages\/\* -r publish --tag next --access public --no-git-checks/);
});

test("typescript-go Go modules match the native-preview package git head", () => {
  const nativePreview = JSON.parse(
    fs.readFileSync(
      require.resolve("@typescript/native-preview/package.json", {
        paths: [workspaceRoot],
      }),
      "utf8",
    ),
  );
  assert.match(nativePreview.gitHead, /^[0-9a-f]{40}$/);

  const goMods = [
    path.join(workspaceRoot, "packages", "ttsc", "go.mod"),
    path.join(workspaceRoot, "packages", "lint", "go.mod"),
    path.join(workspaceRoot, "packages", "paths", "go.mod"),
    path.join(workspaceRoot, "packages", "strip", "go.mod"),
    ...listGoMods(path.join(workspaceRoot, "packages", "ttsc", "shim")),
  ];
  for (const file of goMods) {
    const text = fs.readFileSync(file, "utf8");
    const match = text.match(
      /github\.com\/microsoft\/typescript-go\s+v0\.0\.0-\d{14}-([0-9a-f]{12})/,
    );
    assert.ok(match, `${path.relative(workspaceRoot, file)} must pin typescript-go`);
    assert.equal(
      nativePreview.gitHead.startsWith(match[1]),
      true,
      `${path.relative(workspaceRoot, file)} is not aligned with @typescript/native-preview ${nativePreview.version}`,
    );
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

function listGoMods(root) {
  const out = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && entry.name === "go.mod") {
        out.push(next);
      }
    }
  }
  return out.sort();
}

function listPackageGoArtifacts(root) {
  const out = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile()) {
        out.push(next);
      }
    }
  }
  return out.sort();
}
