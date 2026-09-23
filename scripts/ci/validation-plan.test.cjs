const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  FULL_LANE_IDS,
  normalizePath,
  planForPaths,
} = require("./validation-plan.cjs");

function ids(files) {
  return planForPaths(files).laneIds;
}

test("a leaf package selects shared quality and its own executor", () => {
  assert.deepEqual(ids(["packages/factory/src/index.ts"]), [
    "typecheck",
    "package-defenses",
  ]);
  assert.deepEqual(ids(["packages/wasm/src/index.ts"]), [
    "typecheck",
    "package-defenses",
  ]);
  // The adapter's Windows-only half, the mutation broker, is dead code on a
  // Linux runner, so every path that can change it has to reach a Windows lane
  // or a defect in it cannot fail anywhere (samchon/ttsc#1307). All four of
  // them are pinned, because the mapping is the whole point of the lane.
  for (const file of [
    "packages/unplugin/src/index.ts",
    "tests/test-unplugin/src/index.ts",
  ]) {
    assert.deepEqual(
      ids([file]),
      [
        "typecheck",
        "bundler-defenses",
        "bundler-defenses-windows",
        "bundler-defenses-macos",
      ],
      `${file} must reach the Windows and macOS bundler lanes`,
    );
  }
  for (const file of [
    "packages/metro/src/index.ts",
    "tests/test-metro/src/index.ts",
  ]) {
    assert.deepEqual(ids([file]), [
      "typecheck",
      "bundler-defenses",
      "bundler-defenses-windows",
    ]);
  }
  assert.deepEqual(ids(["packages/banner/src/index.ts"]), [
    "typecheck",
    "package-defenses",
    "ttsc-native",
    "bundler-defenses",
  ]);
  assert.deepEqual(ids(["packages/strip/src/index.ts"]), [
    "typecheck",
    "package-defenses",
    "ttsc-core",
    "ttsc-native",
    "bundler-defenses",
  ]);
  assert.deepEqual(ids(["packages/lint/src/index.ts"]), [
    "go",
    "windows-go",
    "typecheck",
    "ttsc-core",
    "ttsc-native",
    "lint-1",
    "lint-2",
    // The evidence rules link into this engine, so a contributor-API change
    // that breaks them has to fail here rather than after a release.
    "evidence",
  ]);
  // Both evidence suites share one lane, and neither directory name is the
  // lane id, so each is pinned rather than inferred. The Windows Go lane is
  // pinned too: this package's path handling is what differs between platforms,
  // so a plan that dropped it would leave those tests running nowhere.
  // Both rows travel one prefix branch today, and the Go one is kept anyway:
  // #1264 is about running Go tests on Windows, and a later rule inserted above
  // this branch for `packages/evidence/native/` would drop the lane for every Go
  // file while the source row stayed green. That is the regression, so it has a
  // row of its own.
  assert.deepEqual(ids(["packages/evidence/src/index.ts"]), [
    "go",
    "windows-go",
    "typecheck",
    "ttsc-native",
    "evidence",
  ]);
  assert.deepEqual(ids(["packages/evidence/native/base.go"]), [
    "go",
    "windows-go",
    "typecheck",
    "ttsc-native",
    "evidence",
  ]);
  assert.deepEqual(ids(["tests/test-evidence/src/index.ts"]), [
    "typecheck",
    "evidence",
  ]);
  assert.deepEqual(ids(["tests/test-evidence-benchmark/src/index.ts"]), [
    "typecheck",
    "evidence",
  ]);
  assert.deepEqual(
    ids(["benchmarks/evidence/src/EvidenceBenchmarkWorkspace.ts"]),
    ["typecheck", "evidence"],
  );
  // `tests/test-evidence` drives a resident graph session over a real evidence
  // project, and that is the only place the chain from a rule's published units
  // to a graph node runs end to end. Its failure mode is an empty answer, which
  // is also what a correct project with no publisher produces, so no other lane
  // can tell the two apart — the mapping is pinned rather than left to whoever
  // next tidies the graph entry.
  assert.deepEqual(ids(["packages/graph/src/index.ts"]), [
    "typecheck",
    "graph",
    "evidence",
  ]);
  // The two ttsc harnesses have their own workflow and no lane in this plan.
  // Without an explicit skip they fall through to the unknown-input branch and
  // every graph edit silently plans full CI, which reads as a flake rather
  // than as a missing rule.
  for (const file of [
    "benchmarks/graph/src/TtscBenchmarkGraphRunner.ts",
    "benchmarks/graph/assets/questions/manifest.json",
    "benchmarks/performance/src/TtscBenchmarkPerformanceRunner.ts",
  ])
    assert.deepEqual(ids([file]), ["typecheck"], file);
});

test("compiler and platform changes select verified reverse consumers", () => {
  const compiler = planForPaths(["packages/ttsc/src/index.ts"]);
  for (const id of [
    "go",
    "windows-go",
    "package-defenses",
    "ttsc-core",
    "ttsc-native",
    "lint-1",
    "lint-2",
    "bundler-defenses",
    "graph",
  ])
    assert.ok(compiler.laneIds.includes(id), `compiler change lost ${id}`);
  assert.equal(compiler.watch, true);
  assert.equal(compiler.platformMatrix.include.length, 6);
  assert.ok(
    compiler.platformMatrix.include.every((row) => row.experimental),
    "compiler changes must verify every shipped platform package",
  );
  assert.deepEqual(
    compiler.platformMatrix.include
      .filter((row) => row.watch && row.vscode)
      .map((row) => row.name),
    ["linux-x64", "darwin-x64", "win32-x64"],
    "OS behavior belongs to one representative architecture per OS",
  );
  const compilerLinux = compiler.platformMatrix.include.find(
    (row) => row.name === "linux-x64",
  );
  assert.equal(compilerLinux.bun, true);
  assert.equal(compilerLinux.plugin_cache, true);
  assert.equal(compilerLinux.source_map, true);
  assert.equal(compilerLinux.build, false);
  const compilerWindows = compiler.platformMatrix.include.find(
    (row) => row.name === "win32-x64",
  );
  assert.equal(compilerWindows.plugin_cache, true);
  assert.equal(compilerWindows.bun, false);
  assert.equal(compilerWindows.source_map, false);
  assert.deepEqual(
    compiler.platformMatrix.include
      .filter((row) => row.runtime)
      .map((row) => row.name),
    ["darwin-x64", "win32-x64"],
    "the ttsx runtime suite runs on the macOS and Windows representatives; Linux runs it in the core lane",
  );

  const platform = ids(["packages/ttsc-linux-x64/package.json"]);
  assert.ok(platform.includes("ttsc-core"));
  assert.ok(platform.includes("ttsc-native"));
  assert.ok(platform.includes("graph"));
  assert.ok(platform.includes("package-defenses"));
});

test("platform integrations reuse only the physical rows they need", () => {
  const watch = planForPaths([
    "tests/test-ttsc/src/features/watch/test_example.ts",
  ]).platformMatrix.include;
  assert.deepEqual(
    watch.map((row) => row.name),
    ["linux-x64", "darwin-x64", "win32-x64"],
  );
  assert.ok(
    watch.every((row) => row.watch && !row.experimental && !row.vscode),
  );

  const runtimeSuite = planForPaths([
    "tests/test-ttsc/src/features/ttsx-runtime/test_example.ts",
  ]);
  assert.ok(runtimeSuite.laneIds.includes("ttsc-core"));
  assert.deepEqual(
    runtimeSuite.platformMatrix.include.map((row) => row.name),
    ["darwin-x64", "win32-x64"],
  );
  assert.ok(
    runtimeSuite.platformMatrix.include.every(
      (row) =>
        row.runtime &&
        row.build &&
        row.build_scope === "experimental" &&
        row.needs_go &&
        !row.experimental &&
        !row.watch,
    ),
  );
  assert.equal(
    planForPaths(["tests/test-ttsc/src/features/api/test_example.ts"])
      .platformMatrix.include.length,
    0,
    "other feature suites keep their Linux-only topology",
  );

  const vscode = planForPaths(["packages/vscode/src/extension.ts"])
    .platformMatrix.include;
  assert.deepEqual(
    vscode.map((row) => row.name),
    ["linux-x64", "darwin-x64", "win32-x64"],
  );
  assert.ok(
    vscode.every((row) => row.vscode && !row.experimental && !row.watch),
  );
  const vscodeHarness = planForPaths(["scripts/smoke-vscode-install.cjs"]);
  assert.deepEqual(vscodeHarness.laneIds, ["typecheck"]);
  assert.equal(vscodeHarness.platformMatrix.include.length, 3);

  const experimental = planForPaths(["experimental/install/src/index.ts"])
    .platformMatrix.include;
  assert.equal(experimental.length, 6);
  assert.ok(
    experimental.every((row) => row.experimental && !row.watch && !row.vscode),
  );
  assert.ok(
    experimental.every((row) => !row.unplugin_e2e),
    "the generic artifact rehearsal must not duplicate the package E2E",
  );

  // The adapter's real hosts run on every representative OS, since the
  // adapter watches each one differently: the Linux inotify helper, and the
  // Windows and macOS brokers.
  for (const changed of [
    "packages/unplugin/src/index.ts",
    "experimental/test-unplugin/src/index.ts",
  ]) {
    const rows = planForPaths([changed]).platformMatrix.include;
    assert.deepEqual(
      rows.map((row) => row.name),
      ["linux-x64", "darwin-x64", "win32-x64"],
      `${changed} selects the packed E2E on every representative OS`,
    );
    for (const row of rows) {
      assert.equal(row.unplugin_e2e, true);
      assert.equal(row.setup_bun, true);
      assert.equal(row.bun, false);
      assert.equal(row.experimental, false);
      assert.equal(row.source_map, false);
      assert.equal(row.plugin_cache, false);
    }
  }

  const sourceMap = planForPaths(["experimental/source-map/src/index.ts"])
    .platformMatrix.include;
  assert.deepEqual(
    sourceMap.map((row) => row.name),
    ["linux-x64"],
  );
  assert.equal(sourceMap[0].source_map, true);
  assert.equal(sourceMap[0].build, false);

  const pluginCache = planForPaths(["scripts/ci/plugin-cache-persistence.mjs"])
    .platformMatrix.include;
  assert.deepEqual(
    pluginCache.map((row) => row.name),
    ["linux-x64", "win32-x64"],
  );
  assert.ok(
    pluginCache.every(
      (row) =>
        row.plugin_cache && row.build && row.build_scope === "plugin-cache",
    ),
  );
  assert.equal(pluginCache[0].setup_bun, true);
  assert.equal(pluginCache[1].setup_bun, false);
});

test("package-owned tests select only their topology owner", () => {
  assert.deepEqual(
    ids(["tests/test-ttsc/src/native-plugins/server/test_example.ts"]),
    ["typecheck", "ttsc-native"],
  );
  assert.deepEqual(
    ids(["tests/test-ttsc/src/native-plugins/corpus-source/test_example.ts"]),
    ["typecheck", "ttsc-core"],
  );
  assert.deepEqual(
    ids([
      "tests/test-ttsc/src/features/ttsx-runtime/test_ttsx_commonjs_loads_prefix_only_node_builtins.ts",
    ]),
    ["typecheck", "ttsc-core"],
  );
  const watch = planForPaths([
    "tests/test-ttsc/src/features/watch/test_example.ts",
  ]);
  assert.deepEqual(watch.laneIds, ["typecheck"]);
  assert.equal(watch.watch, true);

  const helpers = planForPaths(["tests/utils/src/TestProject.ts"]);
  assert.equal(helpers.watch, true);
  assert.ok(helpers.laneIds.includes("ttsc-core"));
  assert.ok(helpers.laneIds.includes("ttsc-native"));
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
    assert.equal(plan.platformMatrix.include.length, 6, file);
  }
});

test("documentation keeps only the lightweight shared contract", () => {
  assert.deepEqual(ids(["README.md"]), ["typecheck"]);
  assert.deepEqual(ids(["website/src/content/docs/index.mdx"]), ["typecheck"]);
  assert.deepEqual(planForPaths(["README.md"]).platformMatrix.include, []);
});

test("CI support files select their actual executors", () => {
  assert.deepEqual(ids(["scripts/ci/factory-package.test.cjs"]), [
    "typecheck",
    "package-defenses",
  ]);
  for (const file of [
    "scripts/ci/go-test-overlay.cjs",
    "scripts/ci/go-test-runners.test.cjs",
  ])
    assert.deepEqual(ids([file]), ["go", "windows-go", "typecheck"], file);
  // The gofmt wrapper's completeness gate runs beside the format check it
  // defends, in the lane every plan already selects, so it must not add one.
  assert.deepEqual(ids(["scripts/ci/gofmt-wrapper.test.cjs"]), ["typecheck"]);
  assert.deepEqual(ids(["experimental/test-unplugin/src/index.ts"]), [
    "typecheck",
  ]);
  assert.deepEqual(ids(["experimental/install/src/index.ts"]), ["typecheck"]);
});

test("portable path normalization accepts git and Windows spellings", () => {
  assert.equal(
    normalizePath("./packages\\factory\\src\\index.ts"),
    "packages/factory/src/index.ts",
  );
});
