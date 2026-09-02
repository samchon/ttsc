const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..", "..");

test("unplugin scenarios run through one layered package contract", () => {
  const packageRoot = path.join(root, "tests", "test-unplugin");
  const runner = fs.readFileSync(
    path.join(packageRoot, "src", "index.ts"),
    "utf8",
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
  const caseFiles = collectFiles(path.join(packageRoot, "src", "cases")).filter(
    (file) => file.endsWith(".ts"),
  );
  const cases = caseFiles
    .map((file) => fs.readFileSync(file, "utf8"))
    .flatMap((source) => source.match(/^  case_[a-z0-9_]+:/gm) ?? []);
  const wrappers = collectFiles(path.join(packageRoot, "src"))
    .filter((file) => path.basename(file).startsWith("test_"))
    .map((file) => path.relative(packageRoot, file).replaceAll(path.sep, "/"));

  assert.equal(
    caseFiles.length,
    4,
    "three family tables plus one self-contained filesystem case",
  );
  assert.equal(cases.length, 204, "the migration inventory must stay explicit");
  assert.deepEqual(wrappers, []);
  assert.match(runner, /const EXPECTED_CASES = 204;/);
  assert.equal(
    (runner.match(/export async function test_[a-z0-9_]+/g) ?? []).length,
    1,
    "the package must expose one aggregate contract",
  );
  assert.doesNotMatch(runner, /DynamicExecutor|TestExecutor/);
  assert.equal(
    (
      collectFiles(path.join(packageRoot, "src"))
        .map((file) => fs.readFileSync(file, "utf8"))
        .join("\n")
        .match(/export (?:async )?(?:function|const) test_[a-z0-9_]+/g) ?? []
    ).length,
    1,
    "only the aggregate package contract may be a test function",
  );
  assert.deepEqual(Object.keys(manifest.scripts).sort(), [
    "integration",
    "start",
    "unit",
  ]);
  assert.match(manifest.scripts.unit, /--layer=unit$/);
  assert.match(manifest.scripts.integration, /--layer=integration$/);
});

test("the packed adapter rehearsal is one pinned E2E", () => {
  const source = fs.readFileSync(
    path.join(root, "experimental", "test-unplugin", "src", "index.ts"),
    "utf8",
  );
  assert.equal(
    (source.match(/export function test_[a-z0-9_]+/g) ?? []).length,
    1,
    "the packed package must have one E2E entrypoint",
  );
  const dependencies = /const registryDependencies = \[([\s\S]*?)\n\];/.exec(
    source,
  );
  assert.ok(dependencies);
  const specifications = [...dependencies[1].matchAll(/"([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.ok(specifications.length > 0);
  for (const specification of specifications) {
    const version = specification.slice(specification.lastIndexOf("@") + 1);
    assert.match(
      version,
      /^\d+\.\d+\.\d+$/,
      `registry dependency must be pinned: ${specification}`,
    );
  }
  assert.equal(
    (source.match(/\binstallTarballs\(\);/g) ?? []).length,
    1,
    "one consumer workspace must perform one dependency install",
  );
  const workflow = fs.readFileSync(
    path.join(root, ".github", "workflows", "test.yml"),
    "utf8",
  );
  assert.match(
    workflow,
    /bun-version: \d+\.\d+\.\d+/,
    "the Bun runtime exercised by the packed E2E must be pinned",
  );
  assert.doesNotMatch(workflow, /bun-version: latest/);
});

test("native fixtures publish one immutable content-addressed source identity", () => {
  const defaultFixture = fs.readFileSync(
    path.join(
      root,
      "tests",
      "utils",
      "src",
      "unplugin",
      "TestUnpluginProject.ts",
    ),
    "utf8",
  );
  const cacheFixture = fs.readFileSync(
    path.join(
      root,
      "tests",
      "test-unplugin",
      "src",
      "internal",
      "transform-project-cache.ts",
    ),
    "utf8",
  );
  const realFixture = fs.readFileSync(
    path.join(
      root,
      "tests",
      "test-unplugin",
      "src",
      "internal",
      "real-native-envelope.ts",
    ),
    "utf8",
  );
  assert.match(defaultFixture, /crypto\.createHash\("sha256"\)/);
  assert.match(defaultFixture, /fs\.mkdtempSync/);
  assert.match(defaultFixture, /fs\.renameSync\(staging, destination\)/);
  assert.match(
    defaultFixture,
    /materializeSharedSource\(\s*"default-go-plugin",\s*writeGoPlugin/,
  );
  assert.match(
    cacheFixture,
    /materializeSharedSource\(\s*"cache-go-plugin",\s*writeGoPlugin/,
  );
  assert.match(cacheFixture, /isolatedPluginSource: true/g);
  assert.equal(
    (cacheFixture.match(/isolatedPluginSource: true/g) ?? []).length,
    2,
    "only descriptor-mutation scenarios may fork the cache plugin source",
  );
  assert.match(
    realFixture,
    /materializeSharedSource\(\s*"real-native-envelope-module"/,
  );
  assert.match(
    realFixture,
    /path\.join\(moduleRoot, "go\.mod"\)/,
    "the published fixture must own the contributor's Go module",
  );
  assert.match(
    realFixture,
    /const contributor = path\.join\(moduleRoot, "compile-probe"\)/,
    "the linked contributor must remain below the published Go module",
  );
  assert.match(realFixture, /path\.join\(contributor, "probe\.go"\)/);
  assert.match(realFixture, /source: \$\{JSON\.stringify\(contributorRoot\)\}/);
});

function collectFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(location) : [location];
  });
}
