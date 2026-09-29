const assert = require("node:assert/strict");
const { test } = require("node:test");

const fs = require("node:fs");
const path = require("node:path");

const {
  FULL_LANE_IDS,
  LANES,
  NODE_FLOOR,
  OTHER_LANE_OSES,
  validationSteps,
  nodeFloor,
  normalizePath,
  planForPaths,
} = require("./validation-plan.cjs");

function ids(files) {
  return planForPaths(files).laneIds;
}

function physicalJobs(plan) {
  return [...plan.matrix.include, ...plan.platformMatrix.include.filter((row) => row.contract_lanes).map((row) => ({
    id: row.os === "win32" ? "windows-contracts" : "macos-contracts",
    os: row.os === "win32" ? "windows-latest" : "macos-15",
    lanes: row.contract_lanes,
  }))];
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
    "macos-go",
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
    "macos-go",
    "typecheck",
    "ttsc-native",
    "evidence",
  ]);
  assert.deepEqual(ids(["packages/evidence/native/base.go"]), [
    "go",
    "windows-go",
    "macos-go",
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
    "macos-go",
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
    ["linux-x64", "darwin-arm64", "win32-x64"],
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
  for (const id of ["ttsc-core", "ttsc-native"])
    for (const os of ["windows-latest", "macos-15"])
      assert.ok(
        physicalJobs(compiler).some(
          (job) => job.lanes.split(",").includes(id) && job.os === os,
        ),
        `a compiler change must run ${id} on ${os}`,
      );

  const platform = ids(["packages/ttsc-linux-x64/package.json"]);
  assert.ok(platform.includes("ttsc-core"));
  assert.ok(platform.includes("ttsc-native"));
  assert.ok(platform.includes("graph"));
  assert.ok(platform.includes("package-defenses"));
});

test("a Go change of the compiler selects the race lane, a TypeScript one does not", () => {
  // The race detector is the only lane that can report a data race in the LSP
  // proxy (samchon/ttsc#1482), and the proxy links most of the Go module.
  for (const file of [
    "packages/ttsc/internal/lspserver/lsp_proxy.go",
    "packages/ttsc/test/driver/lsp_proxy_harness_test.go",
    "packages/ttsc/driver/program.go",
    "packages/ttsc/go.mod",
    "packages/ttsc/go.sum",
  ])
    assert.ok(ids([file]).includes("go-race"), file);
  for (const file of [
    "packages/ttsc/src/index.ts",
    "packages/ttsc/package.json",
    "packages/unplugin/src/index.ts",
  ])
    assert.ok(!ids([file]).includes("go-race"), file);
  // Its own runner reaches it and nothing else.
  assert.deepEqual(ids(["scripts/test-go-race.cjs"]), ["go-race", "typecheck"]);
});

test("platform integrations reuse only the physical rows they need", () => {
  const watch = planForPaths([
    "tests/test-ttsc/src/features/watch/test_example.ts",
  ]).platformMatrix.include;
  assert.deepEqual(
    watch.map((row) => row.name),
    ["linux-x64", "darwin-arm64", "win32-x64"],
  );
  assert.ok(
    watch.every((row) => row.watch && !row.experimental && !row.vscode),
  );

  // The runtime suite runs in the core lane, whose own macOS and Windows jobs
  // cover the OS behavior, so it takes no platform row.
  for (const file of [
    "tests/test-ttsc/src/features/ttsx-runtime/test_example.ts",
    "tests/test-ttsc/src/features/api/test_example.ts",
  ]) {
    const plan = planForPaths([file]);
    assert.ok(plan.laneIds.includes("ttsc-core"), file);
    assert.equal(plan.platformMatrix.include.length, 0, file);
  }

  const vscode = planForPaths(["packages/vscode/src/extension.ts"])
    .platformMatrix.include;
  assert.deepEqual(
    vscode.map((row) => row.name),
    ["linux-x64", "darwin-arm64", "win32-x64"],
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
    experimental.every((row) => row.build === Boolean(row.contract_lanes)),
    "OS contracts prebuild their shared union; other rehearsals build internally",
  );

  // Packed hosts run once; the workspace adapter suites retain OS backends.
  for (const changed of [
    "packages/unplugin/src/index.ts",
    "experimental/test-unplugin/src/index.ts",
  ]) {
    const plan = planForPaths([changed]);
    assert.deepEqual(
      plan.unpluginMatrix.include.map((row) => row.name),
      ["linux-x64"],
      `${changed} selects one packed host rehearsal`,
    );
    assert.equal(plan.unpluginHostsSelected, true);
    assert.deepEqual(
      plan.unpluginMatrix.include.map((row) => Object.keys(row).sort()),
      plan.unpluginMatrix.include.map(() => ["name", "os", "runner"]),
      "the host matrix varies over the OS alone",
    );
    assert.deepEqual(
      plan.platformMatrix.include,
      [],
      `${changed} starts no platform lane of its own`,
    );
    assert.equal(plan.platformSelected, false);
  }

  // A change that selects both runs each in its own job, and the platform
  // lane keeps the artifact rehearsal that builds the workspace its later
  // steps run against.
  const both = planForPaths([
    "packages/unplugin/src/index.ts",
    "experimental/install/src/index.ts",
  ]);
  assert.deepEqual(
    both.unpluginMatrix.include.map((row) => row.name),
    ["linux-x64"],
  );
  assert.equal(both.platformMatrix.include.length, 6);
  assert.ok(both.platformMatrix.include.every((row) => row.experimental));

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

test("compatible suites share runners while OS boundaries stay covered", () => {
  // Whole portable suites run on Linux. Selected OS boundaries share one
  // runner per OS, including the installed-artifact runner when present.
  const plan = planForPaths(["packages/ttsc/src/index.ts"]);
  const everyOs = LANES.filter((lane) => lane.everyOs === true);
  assert.deepEqual(
    everyOs.map((lane) => lane.id),
    [
      "package-defenses",
      "ttsc-core",
      "ttsc-native",
      "lint-1",
      "lint-2",
      "graph",
      "evidence",
    ],
  );
  for (const lane of everyOs) {
    const linux = plan.matrix.include.find((job) => job.os === "ubuntu-latest" && job.lanes.split(",").includes(lane.id));
    assert.ok(linux, lane.id);
    assert.equal(linux.os, "ubuntu-latest", lane.id);
    if (lane.id === "package-defenses") continue;
    for (const os of OTHER_LANE_OSES) {
      const job = physicalJobs(plan).find(
        (item) => item.id === `${os.id}-contracts`,
      );
      assert.ok(job, `${lane.id} has no ${os.id} job`);
      assert.equal(job.os, os.runner);
      assert.ok(job.lanes.split(",").includes(lane.id));
    }
  }
  // A lane not marked runs once, and the lane ids name the lanes, not the jobs.
  assert.equal(
    plan.matrix.include.filter((job) => job.id === "quality").length,
    1,
  );
  assert.deepEqual(
    plan.laneIds,
    LANES.filter((lane) => plan.laneIds.includes(lane.id)).map(
      (lane) => lane.id,
    ),
  );
  for (const lane of everyOs)
    for (const os of OTHER_LANE_OSES)
      assert.ok(!plan.laneIds.includes(`${lane.id}-${os.id}`));

  // The regression tests of the cache collection and clean (#1562), the
  // compiler's case policy (#1563) and the source-plugin build (#1572) run on
  // Windows and macOS when they change.
  for (const file of [
    "tests/test-ttsc/src/native-plugins/compiler/test_compiler_corpus_clean_removes_the_single_file_caches.ts",
    "tests/test-ttsc/src/features/project/test_prunecachefileroot_collects_unused_single_file_entries.ts",
    "tests/test-ttsc/src/features/api/test_compilerusescasesensitivefilenames_answers_what_the_compiler_reports.ts",
    "tests/test-ttsc/src/native-plugins/source-plugin/test_buildsourceplugin_builds_a_workspace_module_at_a_deep_path.ts",
  ]) {
    const directory = file
      .slice("tests/test-ttsc/src/".length)
      .split("/")
      .slice(0, 2)
      .join("/");
    for (const os of OTHER_LANE_OSES)
      assert.ok(
        physicalJobs(planForPaths([file])).some(
          (job) =>
            job.os === os.runner && validationSteps(job.lanes.split(","), os.id === "windows" ? "win32" : "darwin").some((step) => step.dirs.includes(directory)),
        ),
        `${file} does not run on ${os.id}`,
      );
  }
});

test("every Go package source selects the full Go suite on every OS", () => {
  const missing = [];
  for (const file of [
    "packages/banner/driver/banner.go",
    "packages/paths/driver/paths.go",
    "packages/paths/go.mod",
    "packages/strip/driver/strip.go",
    "packages/wasm/host/plugin.go",
    "packages/lint/linthost/config.go",
    "packages/evidence/native/typescript.go",
    "packages/ttsc/utility/serve.go",
  ]) {
    const selected = ids([file]);
    for (const lane of ["go", "windows-go", "macos-go"])
      if (!selected.includes(lane)) missing.push(`${file}: ${lane}`);
  }
  assert.deepEqual(missing, []);
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
    ["typecheck", "ttsc-core", "runtime-node-floor", "runtime-node-current"],
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
  assert.deepEqual(ids(["scripts/ci/package/factory-package.test.cjs"]), [
    "typecheck",
    "package-defenses",
  ]);
  for (const file of [
    "scripts/ci/go-test-overlay.cjs",
    "scripts/go-test-runners.test.cjs",
  ])
    assert.deepEqual(
      ids([file]),
      ["go", "windows-go", "macos-go", "typecheck"],
      file,
    );
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

test("the runtime lanes pin the engines floor and the newest release", () => {
  // The floor comes from the manifest users install, so raising it there moves
  // the lane, and nothing else in the repository spells the number
  // (samchon/ttsc#1564).
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "..", "packages", "ttsc", "package.json"),
      "utf8",
    ),
  );
  assert.equal(NODE_FLOOR, nodeFloor(manifest));
  assert.equal(`>=${NODE_FLOOR}`, manifest.engines.node.replace(/\s+/g, ""));
  assert.equal(nodeFloor({ engines: { node: ">=24.1.2" } }), "24.1.2");
  assert.equal(nodeFloor({ engines: { node: ">= 22.15.0" } }), "22.15.0");
  for (const node of [
    undefined,
    "22.15.0",
    ">=22",
    "^22.15.0",
    ">=22.15.0 <27",
  ])
    assert.throws(() => nodeFloor({ engines: { node } }), /engines.node/);

  const plan = planForPaths([
    "packages/ttsc/src/launcher/internal/runtime/installRuntimeHooks.ts",
  ]);
  const lanes = Object.fromEntries(
    plan.matrix.include.map((lane) => [lane.id, lane]),
  );
  assert.equal(lanes["runtime-node-floor"].node, NODE_FLOOR);
  assert.equal(lanes["runtime-node-current"].node, "current");
  // Node 24 runs the same suite in the core lane.
  assert.equal(lanes.compiler.node, "");
  for (const id of ["runtime-node-floor", "runtime-node-current"]) {
    assert.equal(
      validationSteps([id])[0].dirs.join(","),
      "features/ttsx-runtime,features/project,native-plugins/utility",
      id,
    );
    assert.ok(validationSteps([id]).some((step) => step.run.includes("test-go-utility-plugins.cjs")), id);
  }
});

test("Node-release code selects the runtime lanes and nothing else does", () => {
  for (const file of [
    "packages/ttsc/src/launcher/internal/runtime/installRuntimeHooks.ts",
    "packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache.ts",
    "packages/ttsc/driver/resolutioninputs/recorder.cjs",
    "packages/banner/driver/config.go",
    "packages/strip/driver/config.go",
    "scripts/test-go-utility-plugins.cjs",
    "tests/test-ttsc/src/features/ttsx-runtime/test_example.ts",
    "tests/test-ttsc/src/features/project/test_example.ts",
    "tests/test-ttsc/src/native-plugins/utility/test_example.ts",
  ]) {
    const selected = ids([file]);
    assert.ok(selected.includes("runtime-node-floor"), file);
    assert.ok(selected.includes("runtime-node-current"), file);
  }
  for (const file of [
    "packages/banner/src/index.ts",
    "packages/strip/src/index.ts",
    "packages/unplugin/src/index.ts",
    "tests/test-ttsc/src/features/api/test_example.ts",
    "tests/test-ttsc/src/native-plugins/server/test_example.ts",
    "README.md",
  ]) {
    const selected = ids([file]);
    assert.ok(!selected.includes("runtime-node-floor"), file);
    assert.ok(!selected.includes("runtime-node-current"), file);
  }
});
