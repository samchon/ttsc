const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const {
  FULL_LANE_IDS,
  LANES,
  WORKFLOW_PATHS,
  normalizePath,
  planForPaths,
} = require("./validation-plan.cjs");
const { PLATFORM_TARGETS, SCOPES } = require("../build-current.cjs");

const root = path.resolve(__dirname, "..", "..");

function ids(files) {
  return planForPaths(files).laneIds;
}

test("a leaf package selects shared quality and its own executor", () => {
  assert.deepEqual(ids(["packages/factory/src/index.ts"]), [
    "typecheck",
    "factory",
  ]);
  assert.deepEqual(ids(["packages/wasm/src/index.ts"]), [
    "typecheck",
    "playground",
    "wasm",
  ]);
  assert.deepEqual(ids(["packages/unplugin/src/index.ts"]), [
    "typecheck",
    "bundler-defenses",
  ]);
});

test("compiler and platform changes select verified reverse consumers", () => {
  const compiler = planForPaths(["packages/ttsc/src/index.ts"]);
  for (const id of [
    "go",
    "windows-go",
    "package-defenses",
    "ttsc-core",
    "ttsx-node-22",
    "ttsc-plugins",
    "ttsc-services",
    "lint-1",
    "lint-2",
    "lint-3",
    "lint-4",
    "bundler-defenses",
    "graph",
  ])
    assert.ok(compiler.laneIds.includes(id), `compiler change lost ${id}`);
  assert.equal(compiler.watch, true);

  const platform = ids(["packages/ttsc-linux-x64/package.json"]);
  assert.ok(platform.includes("ttsc-core"));
  assert.ok(platform.includes("graph"));
  assert.equal(platform.includes("factory"), false);
});

test("package-owned tests select only their topology owner", () => {
  assert.deepEqual(
    ids([
      "tests/test-ttsc/src/native-plugins/server/test_example.ts",
    ]),
    ["typecheck", "ttsc-services"],
  );
  assert.deepEqual(
    ids([
      "tests/test-ttsc/src/features/ttsx-runtime/test_ttsx_commonjs_loads_prefix_only_node_builtins.ts",
    ]),
    ["typecheck", "ttsc-core", "ttsx-node-22"],
  );
  const watch = planForPaths([
    "tests/test-ttsc/src/features/watch/test_example.ts",
  ]);
  assert.deepEqual(watch.laneIds, ["typecheck"]);
  assert.equal(watch.watch, true);

  const helpers = planForPaths(["tests/utils/src/TestProject.ts"]);
  assert.equal(helpers.watch, true);
  assert.ok(helpers.laneIds.includes("ttsc-core"));
  assert.ok(helpers.laneIds.includes("lint-1"));
});

test("root topology, workflow, planner, and unknown inputs fail open", () => {
  for (const file of [
    "pnpm-lock.yaml",
    ".github/workflows/test.yml",
    "scripts/ci/validation-plan.cjs",
    "scripts/ci/a-future-owner.cjs",
    "scripts/a-future-shared-runner.cjs",
    "a-future-executable.xyz",
  ]) {
    const plan = planForPaths([file]);
    assert.deepEqual(plan.laneIds, FULL_LANE_IDS, file);
    assert.equal(plan.watch, true, file);
  }
});

test("documentation keeps only the lightweight shared contract", () => {
  assert.deepEqual(ids(["README.md"]), ["typecheck"]);
  assert.deepEqual(ids(["website/src/content/docs/index.mdx"]), ["typecheck"]);
});

test("CI support files select their actual executors", () => {
  assert.deepEqual(ids(["scripts/ci/factory-package.test.cjs"]), [
    "typecheck",
    "factory",
  ]);
  for (const file of [
    "scripts/ci/go-test-overlay.cjs",
    "scripts/ci/go-test-runners.test.cjs",
    "scripts/ci/website-compiler-module.test.cjs",
  ])
    assert.deepEqual(ids([file]), ["go", "windows-go", "typecheck"], file);
  assert.deepEqual(
    ids(["experimental/test-unplugin/src/index.ts"]),
    ["typecheck"],
  );
});

test("every E2E directory has exactly one normal topology owner", () => {
  assertSuiteTopology("test-ttsc", {
    special: new Set(["features/watch"]),
  });
  assertSuiteTopology("test-lint");
});

test("lane identities and workflow matrix names stay unique", () => {
  assert.equal(new Set(LANES.map((lane) => lane.id)).size, LANES.length);
  assert.equal(new Set(LANES.map((lane) => lane.name)).size, LANES.length);
  for (const lane of LANES) {
    assert.ok(lane.run.length > 0, `${lane.id} has no run command`);
    if (lane.scope !== undefined)
      assert.ok(SCOPES[lane.scope], `${lane.id} has unknown build scope`);
  }
  assert.equal(
    LANES.find((lane) => lane.id === "typecheck")?.needsGo,
    true,
    "format-check invokes gofmt and must use the pinned Go toolchain",
  );
  const typecheckBuild = LANES.find(
    (lane) => lane.id === "typecheck",
  )?.build;
  for (const prerequisite of [
    "@ttsc/banner",
    "@ttsc/lint",
    "@ttsc/wasm",
    "@ttsc/playground",
    "@ttsc/graph",
    "--filter ttsc exec tsc --emitDeclarationOnly",
    "@ttsc/unplugin",
  ])
    assert.match(
      typecheckBuild ?? "",
      new RegExp(prerequisite.replace("/", "\\/")),
      `typecheck fresh-checkout build lost ${prerequisite}`,
    );
  assert.doesNotMatch(
    typecheckBuild ?? "",
    /build:current/,
    "typecheck prerequisites must not rebuild native binaries",
  );
  assert.deepEqual(
    SCOPES["plugin-cache"].filter((target) => typeof target === "string"),
    ["ttsc"],
    "plugin-cache must not rebuild unrelated workspace packages",
  );
  assert.equal(PLATFORM_TARGETS["plugin-cache"], "ttsc");
  assert.equal(PLATFORM_TARGETS["test-packages"], "ttsc");
  assert.equal(PLATFORM_TARGETS["test-graph"], "ttsc,ttscgraph");
  assert.ok(
    SCOPES["test-metro"].includes("@ttsc/banner"),
    "bundler defenses execute banner plugin configuration tests",
  );
});

test("remaining workflow path filters match the repository contract", () => {
  for (const [workflow, expected] of Object.entries(WORKFLOW_PATHS)) {
    const file = path.join(root, ".github", "workflows", `${workflow}.yml`);
    const source = fs.readFileSync(file, "utf8");
    for (const event of ["push", "pull_request"]) {
      const actual = eventPaths(source, event);
      if (actual === null) continue;
      assert.deepEqual(actual, expected, `${workflow}:${event}`);
    }
  }

  const testWorkflow = fs.readFileSync(
    path.join(root, ".github", "workflows", "test.yml"),
    "utf8",
  );
  assert.equal(eventPaths(testWorkflow, "push"), null);
  assert.equal(eventPaths(testWorkflow, "pull_request"), null);
});

test("portable path normalization accepts git and Windows spellings", () => {
  assert.equal(
    normalizePath("./packages\\factory\\src\\index.ts"),
    "packages/factory/src/index.ts",
  );
});

function assertSuiteTopology(suite, options = {}) {
  const sourceRoot = path.join(root, "tests", suite, "src");
  const discovered = discoverTestDirectories(sourceRoot);
  const owners = new Map();
  for (const lane of LANES) {
    if (!lane.dirs) continue;
    const ownsSuite =
      (suite === "test-ttsc" && lane.id.startsWith("ttsc-")) ||
      (suite === "test-lint" && lane.id.startsWith("lint-"));
    if (!ownsSuite) continue;
    for (const directory of lane.dirs) {
      const previous = owners.get(directory);
      assert.equal(previous, undefined, `${directory} owned twice`);
      owners.set(directory, lane.id);
    }
  }
  for (const directory of options.special ?? []) {
    assert.ok(discovered.has(directory), `missing special ${directory}`);
    discovered.delete(directory);
  }
  assert.deepEqual(
    [...owners.keys()].sort(),
    [...discovered].sort(),
    `${suite} topology assignment drifted`,
  );
}

function discoverTestDirectories(sourceRoot) {
  const directories = new Set();
  const visit = (directory) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    if (
      entries.some(
        (entry) => entry.isFile() && /^test_.+\.ts$/.test(entry.name),
      )
    )
      directories.add(
        normalizePath(path.relative(sourceRoot, directory)),
      );
    for (const entry of entries)
      if (entry.isDirectory()) visit(path.join(directory, entry.name));
  };
  visit(sourceRoot);
  return directories;
}

function eventPaths(source, event) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${event}:`);
  if (start === -1) return null;
  let paths = null;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (/^  \S/.test(line)) break;
    if (line === "    paths:") {
      paths = [];
      continue;
    }
    if (paths !== null) {
      const match = /^      - "(.+)"$/.exec(line);
      if (match) paths.push(match[1]);
      else if (/^    \S/.test(line)) break;
    }
  }
  return paths;
}
