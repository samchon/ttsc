const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");

const {
  FULL_LANE_IDS,
  LANES,
  PLATFORM_INTEGRATION_PATHS,
  PLATFORM_ROWS,
  WORKFLOW_PATHS,
  normalizePath,
  planForPaths,
} = require("./validation-plan.cjs");
const { PLATFORM_TARGETS, SCOPES } = require("../build-current.cjs");
const { PACKAGE_BUILDS_BEFORE_PLATFORMS } = require("../build-platforms.cjs");

const root = path.resolve(__dirname, "..", "..");
const testTtscRequire = createRequire(
  path.join(root, "tests", "test-ttsc", "package.json"),
);
const { parse: parseYaml } = testTtscRequire("yaml");

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
  assert.deepEqual(ids(["packages/unplugin/src/index.ts"]), [
    "typecheck",
    "bundler-defenses",
  ]);
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
  ]);
});

test("compiler and platform changes select verified reverse consumers", () => {
  const compiler = planForPaths(["packages/ttsc/src/index.ts"]);
  for (const id of [
    "go",
    "windows-go",
    "package-defenses",
    "ttsc-core",
    "ttsc-native",
    "ttsx-node-22",
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

  const platform = ids(["packages/ttsc-linux-x64/package.json"]);
  assert.ok(platform.includes("ttsc-core"));
  assert.ok(platform.includes("ttsc-native"));
  assert.ok(platform.includes("graph"));
  assert.ok(platform.includes("package-defenses"));
});

test("platform integrations reuse only the physical rows they need", () => {
  assert.equal(PLATFORM_ROWS.length, 6);
  assert.equal(
    PLATFORM_ROWS.filter((row) => row.representative).length,
    3,
  );
  assert.ok(
    PLATFORM_INTEGRATION_PATHS.experimental.includes("packages/ttsc-*/**"),
  );

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

  const vscode = planForPaths([
    "packages/vscode/src/extension.ts",
  ]).platformMatrix.include;
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

  const experimental = planForPaths([
    "experimental/install/src/index.ts",
  ]).platformMatrix.include;
  assert.equal(experimental.length, 6);
  assert.ok(
    experimental.every(
      (row) => row.experimental && !row.watch && !row.vscode,
    ),
  );
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
    "scripts/ci/website-compiler-module.test.cjs",
  ])
    assert.deepEqual(ids([file]), ["go", "windows-go", "typecheck"], file);
  assert.deepEqual(ids(["experimental/test-unplugin/src/index.ts"]), [
    "typecheck",
  ]);
});

test("every E2E directory has exactly one normal topology owner", () => {
  assertSuiteTopology("test-ttsc", {
    special: new Set(["features/watch"]),
  });
  assertSuiteTopology("test-lint");
});

test("lane identities and workflow matrix names stay unique", () => {
  assert.equal(LANES.length, 12, "full main matrix must stay consolidated");
  assert.equal(
    LANES.filter((lane) => lane.build === "pnpm run build:current").length,
    7,
    "full logical plan must keep seven scoped native builds",
  );
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
  const typecheckBuild = LANES.find((lane) => lane.id === "typecheck")?.build;
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
  for (const prerequisite of [
    "@ttsc/factory",
    "@ttsc/banner",
    "@ttsc/wasm",
    "@ttsc/playground",
  ])
    assert.ok(
      SCOPES["test-packages"].some(
        (target) =>
          target === prerequisite ||
          (typeof target === "object" && target.filter === prerequisite),
      ),
      `package defenses lost ${prerequisite}`,
    );
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
  const testDocument = parseYaml(testWorkflow);
  assert.deepEqual(Object.keys(testDocument.jobs), [
    "plan",
    "platform-integrations",
    "test",
    "ci",
  ]);
  assert.equal(
    fs.existsSync(
      path.join(root, ".github", "workflows", "experimental.yml"),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(root, ".github", "workflows", "vscode.yml")),
    false,
  );
  assert.equal(eventPaths(testWorkflow, "push"), null);
  assert.equal(eventPaths(testWorkflow, "pull_request"), null);
  assert.match(
    workflowJob(testWorkflow, "ci"),
    /if: \$\{\{ always\(\) && !cancelled\(\) \}\}/,
    "a superseded run must not queue its aggregate behind cancellation",
  );
  const platformJob = testDocument.jobs["platform-integrations"];
  assert.equal(platformJob["runs-on"], "${{ matrix.runner }}");
  assert.equal(
    platformJob.strategy.matrix,
    "${{ fromJSON(needs.plan.outputs.platform_matrix) }}",
  );
  const platformSteps = platformJob.steps;
  assert.equal(
    platformSteps.find(
      (step) =>
        typeof step.uses === "string" &&
        step.uses.startsWith("actions/setup-go@"),
    ).if,
    "matrix.experimental || matrix.watch",
  );
  assert.equal(
    platformSteps.find(
      (step) => step.name === "Build Current Platform For Watch",
    ).env.TTSC_BUILD_SCOPE,
    "experimental",
  );
  assert.equal(
    platformSteps.find(
      (step) => step.name === "Verify Installed Tarballs With Bundled Go",
    ).run,
    "pnpm run experimental",
  );
  assert.equal(
    platformSteps.find((step) => step.name === "Run watch tests").env
      .TTSC_TEST_DIR,
    "features/watch",
  );
  assert.equal(
    platformSteps.find((step) => step.name === "Build @ttsc/vscode").run,
    "pnpm --filter @ttsc/vscode build",
  );
  assert.equal(
    platformSteps.find(
      (step) => step.name === "Smoke-install @ttsc/vscode in VS Code",
    ).run,
    "node scripts/smoke-vscode-install.cjs packages/vscode",
  );

  const nestiaWorkflow = fs.readFileSync(
    path.join(root, ".github", "workflows", "nestia.yml"),
    "utf8",
  );
  const nestiaDocument = parseYaml(nestiaWorkflow);
  assert.deepEqual(
    Object.keys(nestiaDocument.jobs),
    ["nestia"],
    "nestia compatibility must stay in one broad job",
  );
  const nestiaJob = nestiaDocument.jobs.nestia;
  assert.equal(
    Object.hasOwn(nestiaJob, "needs"),
    false,
    "the single nestia job must not wait for another producer",
  );
  assert.equal(nestiaJob["timeout-minutes"], 60);
  assert.equal(nestiaJob.env.TTSC_TARBALLS_CURRENT, "1");
  const steps = nestiaJob.steps;
  assert.ok(Array.isArray(steps));
  assert.equal(
    steps.some(
      (step) =>
        typeof step.uses === "string" &&
        /^actions\/(?:upload|download)-artifact@/.test(step.uses),
    ),
    false,
    "nestia must consume local tarballs without an artifact handoff",
  );
  assert.deepEqual(
    steps
      .map((step) =>
        typeof step.run === "string" ? executableRun(step.run) : "",
      )
      .filter(containsPnpmCommand),
    [
      "pnpm install --frozen-lockfile",
      "pnpm package:tgz",
      "pnpm install --no-frozen-lockfile",
      "pnpm test",
    ],
    "nestia must keep one tarball build and one complete upstream test command",
  );
  const upstreamTestSteps = steps.filter(
    (step) =>
      typeof step.run === "string" && executableRun(step.run) === "pnpm test",
  );
  assert.equal(upstreamTestSteps.length, 1);
  assert.equal(
    upstreamTestSteps[0]["working-directory"],
    "experimental/nestia",
    "the complete upstream suite must run from the pinned nestia checkout",
  );
  for (const action of [
    "pnpm/action-setup",
    "actions/setup-node",
    "actions/setup-go",
  ])
    assert.equal(
      steps.filter(
        (step) =>
          typeof step.uses === "string" && step.uses.startsWith(`${action}@`),
      ).length,
      1,
      `${action} must be configured exactly once`,
    );

  const buildDocument = parseYaml(
    fs.readFileSync(
      path.join(root, ".github", "workflows", "build.yml"),
      "utf8",
    ),
  );
  assert.deepEqual(
    Object.keys(buildDocument.jobs),
    ["Ubuntu"],
    "the broad build job must also own wasm package smoke checks",
  );
  const buildSteps = buildDocument.jobs.Ubuntu.steps;
  const buildRuns = buildSteps
    .map((step) => (typeof step.run === "string" ? step.run : ""))
    .filter(Boolean);
  assert.equal(
    buildRuns.filter((run) => run.trim() === "pnpm run build").length,
    1,
  );
  assert.ok(
    PACKAGE_BUILDS_BEFORE_PLATFORMS.includes("@ttsc/wasm"),
    "the broad package build must produce wasm artifacts before smoke checks",
  );
  assert.equal(
    buildRuns.some((run) => run.includes("pnpm --filter @ttsc/wasm build")),
    false,
    "the broad package build already builds @ttsc/wasm",
  );
  assert.ok(
    buildRuns.some(
      (run) =>
        run.includes("test -f packages/wasm/dist/ttsc.wasm") &&
        run.includes("test -d packages/wasm/shim-vendor/shim"),
    ),
    "the broad job must retain wasm dist assertions",
  );
  assert.ok(
    buildRuns.some(
      (run) =>
        run.includes("pnpm pack --pack-destination /tmp") &&
        run.includes("grep -q shim-vendor/shim/ast/shim.go") &&
        run.includes("grep -q dist/ttsc.wasm"),
    ),
    "the broad job must retain wasm tarball smoke",
  );
  const stepIndex = (predicate) =>
    buildSteps.findIndex(
      (step) => typeof step.run === "string" && predicate(step.run),
    );
  const buildIndex = stepIndex((run) => run.trim() === "pnpm run build");
  const releaseSmokeIndex = stepIndex((run) =>
    run.includes("assert-ttscgraph-release-candidate.cjs"),
  );
  const distSmokeIndex = stepIndex((run) =>
    run.includes("test -f packages/wasm/dist/ttsc.wasm"),
  );
  const tarballSmokeIndex = stepIndex((run) =>
    run.includes("pnpm pack --pack-destination /tmp"),
  );
  assert.ok(
    buildIndex < releaseSmokeIndex &&
      releaseSmokeIndex < distSmokeIndex &&
      distSmokeIndex < tarballSmokeIndex,
    "the broad build must produce artifacts before every smoke assertion",
  );

  const pluginCacheDocument = parseYaml(
    fs.readFileSync(
      path.join(root, ".github", "workflows", "plugin-cache.yml"),
      "utf8",
    ),
  );
  assert.deepEqual(Object.keys(pluginCacheDocument.jobs), [
    "cache-linux",
    "cache-windows",
  ]);
  const expectedPluginJobs = {
    "cache-linux": {
      runner: "ubuntu-latest",
      managers: ["pnpm", "yarn", "bun", "npm"],
      bun: 1,
    },
    "cache-windows": {
      runner: "windows-latest",
      managers: ["npm", "pnpm"],
      bun: 0,
    },
  };
  for (const [jobName, expected] of Object.entries(expectedPluginJobs)) {
    const job = pluginCacheDocument.jobs[jobName];
    assert.equal(job["runs-on"], expected.runner);
    assert.equal(
      job.strategy,
      undefined,
      `${jobName} must not expand a matrix`,
    );
    for (const action of [
      "actions/checkout",
      "actions/setup-node",
      "actions/setup-go",
      "pnpm/action-setup",
    ])
      assert.equal(
        job.steps.filter(
          (step) =>
            typeof step.uses === "string" && step.uses.startsWith(`${action}@`),
        ).length,
        1,
        `${jobName} must configure ${action} exactly once`,
      );
    assert.equal(
      job.steps.filter(
        (step) =>
          typeof step.uses === "string" &&
          step.uses.startsWith("oven-sh/setup-bun@"),
      ).length,
      expected.bun,
    );
    const systemGo = job.steps.find(
      (step) => step.name === "Use System Go For Source Plugin Builds",
    );
    assert.equal(systemGo.shell, "bash");
    assert.equal(
      systemGo.run,
      'echo "TTSC_GO_BINARY=$(go env GOROOT)/bin/go" >> "$GITHUB_ENV"',
    );
    const build = job.steps.find(
      (step) => step.name === "Build Current Platform",
    );
    assert.equal(build.run, "pnpm run build:current");
    assert.equal(build.env.TTSC_BUILD_SCOPE, "plugin-cache");
    const verification = job.steps.find(
      (step) =>
        typeof step.name === "string" &&
        step.name.startsWith("Verify ") &&
        step.name.endsWith(" Package Managers"),
    );
    assert.ok(verification, `${jobName} lost package-manager verification`);
    assert.equal(verification.shell, "bash");
    const verificationLines = [
      "status=0",
      ...expected.managers.map(
        (manager) =>
          `node scripts/ci/plugin-cache-persistence.mjs --pm=${manager} || status=1`,
      ),
      'exit "$status"',
    ];
    assert.deepEqual(
      verification.run
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      verificationLines,
      `${jobName} must run every manager before reporting failure`,
    );
    assert.deepEqual(
      job.steps
        .filter((step) => typeof step.run === "string")
        .map((step) => step.run.trim()),
      [
        "pnpm install --frozen-lockfile",
        'echo "TTSC_GO_BINARY=$(go env GOROOT)/bin/go" >> "$GITHUB_ENV"',
        "pnpm run build:current",
        verificationLines.join("\n"),
      ],
      `${jobName} must install and build exactly once before verification`,
    );
  }
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
      directories.add(normalizePath(path.relative(sourceRoot, directory)));
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

function workflowJob(source, name) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${name}:`);
  assert.notEqual(start, -1, `missing workflow job: ${name}`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++)
    if (/^  [^\s].*:$/.test(lines[index])) {
      end = index;
      break;
    }
  return lines.slice(start, end).join("\n");
}

function executableRun(run) {
  return run
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .join("\n");
}

function containsPnpmCommand(run) {
  return run.split(/\r?\n/).some((line) => /\bpnpm(?=\s|$)/.test(line));
}
