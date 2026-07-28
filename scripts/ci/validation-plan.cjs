const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

/**
 * One repository-owned description of every main test job.
 *
 * `dirs` are relative to the owning test package's `src/` directory. Several
 * locations in one lane are scanned in one process so package builds and the
 * content-addressed source-plugin cache stay warm across named subcases.
 */
const LANES = [
  {
    id: "go",
    name: "go",
    needsGo: true,
    build: "pnpm --filter ttsc build",
    run: "pnpm run test:go && pnpm --filter ttsc go:vet",
  },
  {
    id: "windows-go",
    name: "windows-go",
    os: "windows-latest",
    needsGo: true,
    build: "pnpm --filter ttsc build",
    run:
      "node --test packages/ttsc/scripts/check-flags.test.cjs && " +
      "pnpm run test:go",
  },
  {
    id: "shim-audit",
    name: "shim-audit",
    needsGo: true,
    run: "pnpm --filter ttsc shim:audit:test && pnpm --filter ttsc shim:audit",
  },
  {
    id: "typecheck",
    name: "typecheck",
    needsGo: true,
    build:
      "pnpm --filter @ttsc/banner build && " +
      "pnpm --filter @ttsc/lint build && " +
      "pnpm --filter @ttsc/wasm build:ts && " +
      "pnpm --filter @ttsc/playground build && " +
      "pnpm --filter @ttsc/graph exec rimraf lib && " +
      "pnpm --filter @ttsc/graph exec tsc --emitDeclarationOnly && " +
      "pnpm --filter ttsc exec rimraf lib && " +
      "pnpm --filter ttsc exec tsc --emitDeclarationOnly && " +
      "pnpm --filter @ttsc/unplugin exec rimraf lib && " +
      "pnpm --filter @ttsc/unplugin exec tsc --emitDeclarationOnly",
    run:
      "pnpm run check:flags && pnpm run check:dependencies && " +
      "node --test packages/ttsc/scripts/check-flags.test.cjs && " +
      "node --test scripts/ci/validation-plan.test.cjs " +
      "scripts/ci/test-owners.test.cjs scripts/ci/line-endings.test.cjs " +
      "scripts/ci/dependency-audit.test.cjs && " +
      "node scripts/ci/format-check.cjs && pnpm run test:typecheck",
  },
  {
    id: "package-defenses",
    name: "package defenses",
    needsGo: true,
    scope: "test-packages",
    build: "pnpm run build:current",
    run:
      "node --test scripts/ci/factory-package.test.cjs && " +
      "pnpm --filter @ttsc/test-banner start && " +
      "pnpm --filter @ttsc/test-paths start && " +
      "pnpm --filter @ttsc/test-strip start && " +
      "pnpm --filter @ttsc/test-playground start && " +
      "pnpm --filter @ttsc/test-wasm start && " +
      "pnpm --filter @ttsc/test-factory start",
  },
  {
    id: "ttsc-core",
    name: "ttsc core defenses",
    needsGo: true,
    scope: "test-ttsc",
    build: "pnpm run build:current",
    run: "pnpm --filter @ttsc/test-ttsc start",
    dirs: [
      "features/api",
      "features/compiler",
      "features/platform",
      "features/project",
      "features/tsgo",
      "features/ttscserver",
      "features/ttsx-runtime",
      "features/utility-plugins",
      "native-plugins/cli",
      "native-plugins/compiler",
      "native-plugins/corpus-source",
      "native-plugins/corpus-ttsc",
      "native-plugins/driver",
      "native-plugins/source-plugin",
    ],
  },
  {
    id: "ttsc-native",
    name: "ttsc native defenses",
    needsGo: true,
    scope: "test-ttsc",
    build: "pnpm run build:current",
    run: "pnpm --filter @ttsc/test-ttsc start",
    dirs: [
      "native-plugins/corpus-misc",
      "native-plugins/server",
      "native-plugins/service",
      "native-plugins/service-incremental",
      "native-plugins/utility",
      "native-plugins/utility-host",
    ],
  },
  {
    id: "ttsx-node-22",
    name: "ttsx node 22.15",
    node: "22.15.0",
    build: "pnpm --filter ttsc build",
    run:
      "pnpm --filter @ttsc/test-ttsc start -- " +
      "--include=commonjs_loads_prefix_only_node_builtins",
    dirs: ["features/ttsx-runtime"],
  },
  {
    id: "lint-1",
    name: "lint defense 1",
    needsGo: true,
    scope: "test-lint",
    build: "pnpm run build:current",
    run: "pnpm --filter @ttsc/test-lint start",
    dirs: [
      "features/config",
      "features/contributor",
      "features/harness",
      "features/plugin",
      "native-plugins/corpus",
      "native-plugins/corpus-2",
    ],
  },
  {
    id: "lint-2",
    name: "lint defense 2",
    needsGo: true,
    scope: "test-lint",
    build: "pnpm run build:current",
    run: "pnpm --filter @ttsc/test-lint start",
    dirs: [
      "native-plugins/corpus-3",
      "native-plugins/config",
      "native-plugins/corpus-4",
      "native-plugins/fix",
      "native-plugins/format",
    ],
  },
  {
    id: "bundler-defenses",
    name: "bundler defenses",
    needsGo: true,
    scope: "test-metro",
    build: "pnpm run build:current",
    run:
      "pnpm --filter @ttsc/test-unplugin start && " +
      "pnpm --filter @ttsc/test-metro start",
  },
  {
    id: "graph",
    name: "graph",
    needsGo: true,
    scope: "test-graph",
    build: "pnpm run build:current",
    run: "pnpm --filter @ttsc/test-graph start",
  },
];

const LANE_BY_ID = new Map(LANES.map((lane) => [lane.id, lane]));
const FULL_LANE_IDS = LANES.map((lane) => lane.id);
const LINT_LANE_IDS = ["lint-1", "lint-2"];
const E2E_LANE_IDS = [
  "package-defenses",
  "ttsc-core",
  "ttsc-native",
  "ttsx-node-22",
  ...LINT_LANE_IDS,
  "bundler-defenses",
  "graph",
];
const TTSC_DOWNSTREAM_IDS = [
  "go",
  "windows-go",
  "package-defenses",
  "ttsc-core",
  "ttsc-native",
  "ttsx-node-22",
  ...LINT_LANE_IDS,
  "bundler-defenses",
  "graph",
];
const PLATFORM_IDS = [
  "package-defenses",
  "ttsc-core",
  "ttsc-native",
  ...LINT_LANE_IDS,
  "bundler-defenses",
  "graph",
];

/**
 * Physical runners for shipped native packages.
 *
 * Watch backends and VS Code installation differ by OS, not CPU architecture,
 * so only the representative x64 row for each OS owns those checks. When an
 * experimental package surface changes, all six rows still verify the shipped
 * native artifacts.
 */
const PLATFORM_ROWS = [
  {
    name: "linux-x64",
    runner: "ubuntu-24.04",
    representative: true,
  },
  {
    name: "linux-arm64",
    runner: "ubuntu-24.04-arm",
    representative: false,
  },
  {
    name: "darwin-x64",
    runner: "macos-15-intel",
    representative: true,
  },
  {
    name: "darwin-arm64",
    runner: "macos-15",
    representative: false,
  },
  {
    name: "win32-x64",
    runner: "windows-2025",
    representative: true,
  },
  {
    name: "win32-arm64",
    runner: "windows-11-arm",
    representative: false,
  },
];

/**
 * Exact workflow path contracts that remain at workflow creation time.
 *
 * The main test workflow intentionally has no path filter: GitHub can leave a
 * required filtered workflow Pending and evaluates only the first 300 changed
 * files. Its expensive work is selected by `planForPaths` instead.
 */
const WORKFLOW_PATHS = {
  benchmark: [
    ".github/workflows/benchmark.yml",
    "experimental/benchmark/**",
    "packages/ttsc/**",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ],
  build: [
    ".github/workflows/build.yml",
    "config/**",
    "scripts/assert-platform-package.cjs",
    "scripts/assert-ttscgraph-release-candidate.cjs",
    "scripts/build-platform-package.cjs",
    "scripts/build-platforms.cjs",
    "scripts/go-build-cache.cjs",
    "scripts/go-sdk-extraction.cjs",
    "scripts/go-sdk-integrity.cjs",
    "scripts/go-wasm-exec.cjs",
    "scripts/platform-target.cjs",
    "packages/**",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ],
  bun: integrationPaths("bun", "experimental/test-unplugin/**"),
  nestia: integrationPaths("nestia"),
  "plugin-cache": [
    ".github/workflows/plugin-cache.yml",
    "scripts/build-current.cjs",
    "scripts/build-platform-package.cjs",
    "scripts/go-build-cache.cjs",
    "scripts/go-sdk-extraction.cjs",
    "scripts/go-sdk-integrity.cjs",
    "scripts/platform-target.cjs",
    "scripts/ci/plugin-cache-persistence.mjs",
    "packages/ttsc/**",
    "packages/ttsc-*/**",
    "tests/projects/go-source-plugin/**",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ],
  "source-map": integrationPaths(
    "source-map",
    "experimental/source-map/**",
  ),
  typia: integrationPaths("typia"),
  website: [
    ".github/workflows/website.yml",
    "config/**",
    "packages/ttsc/**",
    "packages/lint/**",
    "packages/wasm/**",
    "packages/playground/**",
    "scripts/go-build-cache.cjs",
    "website/**",
    "README.md",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ],
};

const PLATFORM_INTEGRATION_PATHS = {
  experimental: integrationSurfacePaths(
    "experimental/install/**",
    "experimental/test-unplugin/**",
  ),
  vscode: [
    "config/**",
    "packages/vscode/**",
    "packages/ttsc/package.json",
    "packages/ttsc/src/**",
    "scripts/assert-vscode-package.cjs",
    "scripts/smoke-vscode-install.cjs",
    "tests/test-ttsc/src/features/ttscserver/test_vscode_install_script_uses_windows_command_shim.ts",
    "LICENSE",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ],
};

function integrationPaths(workflow, ...harnesses) {
  return [
    `.github/workflows/${workflow}.yml`,
    ...integrationSurfacePaths(...harnesses),
  ];
}

function integrationSurfacePaths(...harnesses) {
  return [
    ...harnesses,
    "experimental/tarballs/**",
    "config/**",
    "scripts/assert-platform-package.cjs",
    "scripts/build-current.cjs",
    "scripts/build-platform-package.cjs",
    "scripts/go-build-cache.cjs",
    "scripts/go-sdk-extraction.cjs",
    "scripts/go-sdk-integrity.cjs",
    "scripts/platform-target.cjs",
    "packages/ttsc/**",
    "packages/banner/**",
    "packages/lint/**",
    "packages/paths/**",
    "packages/strip/**",
    "packages/unplugin/**",
    "packages/ttsc-*/**",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ];
}

/**
 * Compute the expensive validation selected by a set of repository paths.
 *
 * The planner always keeps the shared type/format/ownership contract. Known
 * leaf owners add only their direct and verified reverse consumers. Any input
 * that can change dependency topology or is not classified fails open.
 */
function planForPaths(files) {
  const normalized = [...new Set(files.map(normalizePath).filter(Boolean))];
  if (normalized.length === 0) return fullPlan("no changed paths");

  const selected = new Set(["typecheck"]);
  let watch = false;
  const integrations = {
    experimental: matchesAnyPath(
      normalized,
      PLATFORM_INTEGRATION_PATHS.experimental,
    ),
    vscode: matchesAnyPath(normalized, PLATFORM_INTEGRATION_PATHS.vscode),
  };
  const reasons = [];
  const add = (ids, reason) => {
    for (const id of ids) selected.add(id);
    reasons.push(reason);
  };

  for (const file of normalized) {
    if (isFullPlanInput(file)) return fullPlan(`fail-open input: ${file}`);

    if (file.startsWith("packages/ttsc/")) {
      add(TTSC_DOWNSTREAM_IDS, file);
      watch = true;
      if (file.startsWith("packages/ttsc/shim/")) selected.add("shim-audit");
      continue;
    }
    if (/^packages\/ttsc-[^/]+\//.test(file)) {
      add(PLATFORM_IDS, file);
      continue;
    }
    if (file.startsWith("packages/lint/")) {
      add(
        [
          "go",
          "windows-go",
          ...LINT_LANE_IDS,
          "ttsc-core",
          "ttsc-native",
        ],
        file,
      );
      continue;
    }
    if (file.startsWith("packages/banner/")) {
      add(["package-defenses", "ttsc-native", "bundler-defenses"], file);
      continue;
    }
    if (file.startsWith("packages/paths/")) {
      add(["package-defenses", "ttsc-native"], file);
      continue;
    }
    if (file.startsWith("packages/strip/")) {
      add(
        ["package-defenses", "ttsc-core", "ttsc-native", "bundler-defenses"],
        file,
      );
      continue;
    }
    if (file.startsWith("packages/factory/")) {
      add(["package-defenses"], file);
      continue;
    }
    if (file.startsWith("packages/wasm/")) {
      add(["package-defenses"], file);
      continue;
    }
    if (file.startsWith("packages/playground/")) {
      add(["package-defenses"], file);
      continue;
    }
    if (file.startsWith("packages/graph/")) {
      add(["graph"], file);
      continue;
    }
    if (file.startsWith("packages/unplugin/")) {
      add(["bundler-defenses"], file);
      continue;
    }
    if (file.startsWith("packages/metro/")) {
      add(["bundler-defenses"], file);
      continue;
    }
    if (file.startsWith("packages/vscode/")) {
      add(["ttsc-core"], file);
      continue;
    }
    if (file.startsWith("tests/test-ttsc/")) {
      const ttsc = planTtscTest(file);
      add(ttsc.lanes, file);
      watch ||= ttsc.watch;
      continue;
    }
    const packageTest = /^tests\/test-([^/]+)\//.exec(file);
    if (packageTest !== null) {
      const lane = packageTest[1];
      if (
        ["banner", "factory", "paths", "playground", "strip", "wasm"].includes(
          lane,
        )
      ) {
        add(["package-defenses"], file);
        continue;
      }
      if (["unplugin", "metro"].includes(lane)) {
        add(["bundler-defenses"], file);
        continue;
      }
      if (lane === "lint") {
        add(LINT_LANE_IDS, file);
        continue;
      }
      if (LANE_BY_ID.has(lane)) {
        add([lane], file);
        continue;
      }
      return fullPlan(`unknown test package: ${file}`);
    }
    if (
      file.startsWith("tests/utils/") ||
      file.startsWith("tests/lint-contributor-demo/")
    ) {
      add(
        file.startsWith("tests/utils/")
          ? E2E_LANE_IDS
          : [...LINT_LANE_IDS, "ttsc-native"],
        file,
      );
      if (file.startsWith("tests/utils/")) watch = true;
      continue;
    }
    if (file.startsWith("tests/projects/")) {
      add(["ttsc-core", "ttsc-native", ...LINT_LANE_IDS], file);
      continue;
    }
    if (file.startsWith("tests/go-transformer/")) {
      add(["go", "windows-go"], file);
      continue;
    }
    if (file.startsWith("scripts/test-go") || file === "scripts/go.cjs") {
      add(["go", "windows-go"], file);
      continue;
    }
    if (
      file === "scripts/shim-audit.cjs" ||
      file === "scripts/shim-audit-test.cjs"
    ) {
      add(["shim-audit"], file);
      continue;
    }
    if (file === "scripts/ci/factory-package.test.cjs") {
      add(["package-defenses"], file);
      continue;
    }
    if (
      [
        "scripts/assert-vscode-package.cjs",
        "scripts/smoke-vscode-install.cjs",
      ].includes(file)
    ) {
      continue;
    }
    if (
      [
        "scripts/ci/go-test-overlay.cjs",
        "scripts/ci/go-test-runners.test.cjs",
        "scripts/ci/website-compiler-module.test.cjs",
      ].includes(file)
    ) {
      add(["go", "windows-go"], file);
      continue;
    }
    if (
      [
        "scripts/ci/dependency-audit.cjs",
        "scripts/ci/dependency-audit.test.cjs",
        "scripts/ci/format-check.cjs",
        "scripts/ci/line-endings.test.cjs",
        "scripts/ci/plugin-cache-persistence.mjs",
        "scripts/ci/test-owners.cjs",
        "scripts/ci/test-owners.test.cjs",
      ].includes(file)
    ) {
      continue;
    }
    if (file.startsWith("experimental/test-unplugin/")) {
      continue;
    }
    if (
      file.startsWith("experimental/") ||
      file.startsWith("website/") ||
      isDocumentation(file)
    ) {
      continue;
    }
    if (file.startsWith("scripts/")) {
      return fullPlan(`unknown shared script: ${file}`);
    }
    return fullPlan(`unknown input: ${file}`);
  }

  return createPlan(selected, watch, reasons, integrations);
}

function planTtscTest(file) {
  if (file.includes("/features/watch/")) return { lanes: [], watch: true };
  if (
    file.endsWith(
      "/test_ttsx_commonjs_loads_prefix_only_node_builtins.ts",
    )
  )
    return { lanes: ["ttsc-core", "ttsx-node-22"], watch: false };
  if (file.includes("/features/"))
    return { lanes: ["ttsc-core"], watch: false };
  for (const lane of LANES.filter((item) => item.id.startsWith("ttsc-"))) {
    if (
      lane.dirs?.some((directory) =>
        file.startsWith(`tests/test-ttsc/src/${directory}/`),
      )
    )
      return { lanes: [lane.id], watch: false };
  }
  return { lanes: FULL_LANE_IDS, watch: true };
}

function isFullPlanInput(file) {
  return (
    file === ".gitattributes" ||
    file === ".gitignore" ||
    file === ".prettierignore" ||
    file.startsWith(".github/workflows/") ||
    file.startsWith("config/") ||
    file === "package.json" ||
    file === "pnpm-lock.yaml" ||
    file === "pnpm-workspace.yaml" ||
    file === "scripts/build-current.cjs" ||
    file === "scripts/ci/validation-plan.cjs" ||
    file === "scripts/ci/validation-plan.test.cjs"
  );
}

function isDocumentation(file) {
  return (
    file === "AGENTS.md" ||
    file === "CLAUDE.md" ||
    file === "LICENSE" ||
    file.endsWith(".md") ||
    file.endsWith(".mdx") ||
    file.startsWith(".agents/")
  );
}

function fullPlan(reason) {
  return createPlan(new Set(FULL_LANE_IDS), true, [reason], {
    experimental: true,
    vscode: true,
  });
}

function createPlan(selected, watch, reasons, integrations) {
  const include = LANES.filter((lane) => selected.has(lane.id)).map(
    workflowLane,
  );
  const platform = createPlatformPlan({
    experimental: integrations.experimental,
    vscode: integrations.vscode,
    watch,
  });
  return {
    matrix: { include },
    laneIds: include.map((lane) => lane.id),
    platformMatrix: platform.matrix,
    platformSelected: platform.matrix.include.length > 0,
    platformTasks: platform.tasks,
    watch,
    reasons: [...new Set(reasons)],
  };
}

function createPlatformPlan(tasks) {
  const include = PLATFORM_ROWS.filter(
    (row) => tasks.experimental || row.representative,
  )
    .map((row) => ({
      name: row.name,
      runner: row.runner,
      experimental: tasks.experimental,
      watch: tasks.watch && row.representative,
      vscode: tasks.vscode && row.representative,
    }))
    .filter((row) => row.experimental || row.watch || row.vscode);
  return {
    matrix: { include },
    tasks: Object.entries(tasks)
      .filter(([, selected]) => selected)
      .map(([task]) => task),
  };
}

function workflowLane(lane) {
  return {
    id: lane.id,
    name: lane.name,
    os: lane.os ?? "ubuntu-latest",
    node: lane.node ?? "24.x",
    needsGo: lane.needsGo ?? false,
    build: lane.build ?? "",
    run: lane.run,
    scope: lane.scope ?? "",
    dirs: lane.dirs?.join(",") ?? "",
  };
}

function changedPaths(base, head, eventName) {
  if (!isSha(base) || !isSha(head) || /^0+$/.test(base))
    return { files: null, reason: "missing or invalid comparison SHA" };
  const separator = eventName === "pull_request" ? "..." : "..";
  const result = cp.spawnSync(
    "git",
    [
      "diff",
      "--name-only",
      "--no-renames",
      "-z",
      `${base}${separator}${head}`,
    ],
    {
      cwd: root,
      encoding: "buffer",
      windowsHide: true,
    },
  );
  if (result.status !== 0)
    return {
      files: null,
      reason: `git diff failed: ${result.stderr?.toString("utf8").trim()}`,
    };
  return {
    files: result.stdout.toString("utf8").split("\0").filter(Boolean),
    reason: null,
  };
}

function isSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
}

function normalizePath(file) {
  return String(file).replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function matchesAnyPath(files, patterns) {
  return files.some((file) =>
    patterns.some((pattern) => {
      const expression = pattern
        .split("*")
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join(".*");
      return new RegExp(`^${expression}$`).test(file);
    }),
  );
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith("--"))
      throw new Error(`unexpected argument: ${argument}`);
    const equals = argument.indexOf("=");
    if (equals !== -1) {
      options[argument.slice(2, equals)] = argument.slice(equals + 1);
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`missing value for ${argument}`);
    options[argument.slice(2)] = value;
    index++;
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const diff = changedPaths(options.base, options.head, options.event);
  const plan =
    diff.files === null ? fullPlan(diff.reason) : planForPaths(diff.files);
  const matrix = JSON.stringify(plan.matrix);
  const platformMatrix = JSON.stringify(plan.platformMatrix);
  const output = [
    `matrix=${matrix}`,
    `lanes=${plan.laneIds.join(",")}`,
    `platform_matrix=${platformMatrix}`,
    `platform=${String(plan.platformSelected)}`,
    `platform_tasks=${plan.platformTasks.join(",")}`,
  ].join("\n");
  if (options["github-output"]) {
    fs.appendFileSync(options["github-output"], `${output}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }
  process.stderr.write(
    `validation plan: ${plan.laneIds.join(", ")}; ` +
      `platform=${plan.platformTasks.join(",") || "none"}; ` +
      `${plan.reasons.join("; ") || "no expensive owner"}\n`,
  );
}

module.exports = {
  E2E_LANE_IDS,
  FULL_LANE_IDS,
  LANES,
  PLATFORM_INTEGRATION_PATHS,
  PLATFORM_ROWS,
  WORKFLOW_PATHS,
  changedPaths,
  fullPlan,
  normalizePath,
  planForPaths,
};

if (require.main === module) main();
