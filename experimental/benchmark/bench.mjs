#!/usr/bin/env node
/**
 * Prepared-clone benchmark runner for the ttsc comparison matrix.
 *
 * The benchmark worktree is `experimental/benchmark/.work` by default. Each
 * measured repository is cloned once per branch into:
 *
 * .work/<repo>@legacy .work/<repo>@ttsc .work/<repo>@ttsc-lint
 *
 * Existing clone directories are preserved. Missing directories are cloned,
 * installed, prepared, and then measured. `ttsc prepare` runs before timings so
 * plugin/native binary build time is not included in compiler measurements.
 *
 * Useful modes:
 *
 * - `node bench.mjs --setup-only`
 * - `node bench.mjs --verify-only`
 * - `node bench.mjs --project vue --project type-fest`
 * - `node bench.mjs --project=type-fest --ttsc-build-only`
 * - `node bench.mjs --project=type-fest --only-ttsc-build --reset`
 * - `node bench.mjs --project=type-fest --only-ttsc-build --no-website`
 * - `node bench.mjs --project=type-fest --lint-only`
 * - `node bench.mjs --cell-filter=':ttsc:build:' vue type-fest`
 *
 * Default output is milestone-only: phase timers, per-cell `run i: N ms`, and
 * short status lines ("Cloning X", "Installing X", "Reusing X"). Child process
 * stdio (pnpm/npm/yarn install, pack, per-step build output) is captured and
 * suppressed.
 *
 * Pass `--verbose` to surface everything — child stdio is teed live, and the
 * granular `[cmd] start/done`, `[step] start/done`, and `[timer] start` traces
 * are added back. This is the mode intended for AI/agent runs that need the
 * full command transcript for diagnosis; a human watching live progress usually
 * wants the default.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const { cellFilters, flags, projectArgs, positional } = parseCliArgs(
  process.argv.slice(2),
);
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const WORK =
  process.env.TTSC_BENCH_WORK ?? path.resolve(import.meta.dirname, ".work");
const TGZ =
  process.env.TTSC_BENCH_TGZ ??
  path.join(
    os.tmpdir(),
    flags.has("--no-pack") ? "ttsc-tgz" : `ttsc-tgz-${process.pid}`,
  );
const OUT =
  process.env.TTSC_BENCH_OUT ??
  path.resolve(import.meta.dirname, ".work", "report.md");
const WEBSITE_JSON = path.resolve(
  REPO_ROOT,
  "website",
  "public",
  "benchmark.json",
);
const REPORT_JSON = OUT.replace(/\.md$/, ".json");
const CHECKPOINT_JSON =
  process.env.TTSC_BENCH_CHECKPOINT ??
  path.resolve(WORK, "benchmark.checkpoint.json");
const TSCONFIG_FILES = quote(
  path.join(import.meta.dirname, "tsconfig-files.mjs"),
);

const RUNS = numberEnv("TTSC_BENCH_RUNS", 5);
const WARMUP = numberEnv("TTSC_BENCH_WARMUP", 1, { allowZero: true });
const RETRIES = numberEnv("TTSC_BENCH_RETRIES", 2);
// AI/debug knob — see the header comment. When set, child stdio is inherited
// (teed for runSteps so race detection still works) and granular start/done
// traces are written. Human runs leave it off and read milestone lines only.
const VERBOSE = flags.has("--verbose");
const BRANCHES = ["legacy", "ttsc", "ttsc-lint"];
const TTSC_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "packages/ttsc/package.json"), "utf8"),
).version;
// Pin the TypeScript-Go runtime to the repository lockfile, not whatever a
// fixture happened to resolve. Fixtures will be normalized later so every ttsc
// branch measures the same workspace runtime.
const NATIVE_PREVIEW_VERSION =
  readNativePreviewLockVersion(REPO_ROOT) ??
  packageVersion(
    path.join(REPO_ROOT, "node_modules", "@typescript", "native-preview"),
  ) ??
  readNativePreviewWorkspaceCatalogVersion(REPO_ROOT);
const PLATFORM_KEY = `${process.platform}-${process.arch}`;
const PLATFORM_PACKAGE = `@ttsc/${PLATFORM_KEY}`;
const NATIVE_PREVIEW_PLATFORM_PACKAGE = `@typescript/native-preview-${PLATFORM_KEY}`;
const GENERATED_PNPM_WORKSPACE = 'packages:\n  - "."\n';
const LEGACY_TYPESCRIPT_DISPLAY_VERSION = "v6.0.3";
const LOCAL_TARBALLS = [
  {
    dir: "packages/ttsc",
    file: `ttsc-${TTSC_VERSION}.tgz`,
    name: "ttsc",
  },
  {
    dir: "packages/lint",
    file: `ttsc-lint-${TTSC_VERSION}.tgz`,
    name: "@ttsc/lint",
  },
  {
    dir: `packages/ttsc-${PLATFORM_KEY}`,
    file: `ttsc-${PLATFORM_KEY}-${TTSC_VERSION}.tgz`,
    name: PLATFORM_PACKAGE,
  },
];

const PACKAGE_CONFIGS = {
  vue: {
    kind: "frontend monorepo",
    repoName: "ttsc-benchmark-vue",
    repo: "https://github.com/samchon/ttsc-benchmark-vue.git",
    packageManager: "pnpm",
    filesRoot: "packages",
    commands: compilerCommands({
      build: (tool) => [`pnpm exec ${tool} -p tsconfig.json`],
      noEmit: (tool) => [`pnpm exec ${tool} -p tsconfig.json --noEmit`],
      eslint: [
        `pnpm exec eslint --no-ignore ${tsconfigFiles("tsconfig.json")}`,
      ],
      format: {
        legacy: [
          `pnpm exec prettier --check --ignore-path /dev/null ${tsconfigFiles("tsconfig.json")}`,
        ],
        ttscLint: ["pnpm exec ttsc format -p tsconfig.json"],
      },
    }),
  },
  rxjs: {
    kind: "library monorepo",
    repoName: "ttsc-benchmark-rxjs",
    repo: "https://github.com/samchon/ttsc-benchmark-rxjs.git",
    packageManager: "yarn",
    filesRoot: "packages",
    commands: compilerCommands({
      build: (tool) => [
        {
          cwd: "packages/observable",
          cmd: `yarn --ignore-engines exec ${tool} -- -p tsconfig.json`,
        },
        ...rxjsBuildSteps(tool),
      ],
      noEmit: (tool) => [
        {
          cwd: "packages/observable",
          cmd: `yarn --ignore-engines exec ${tool} -- -p tsconfig.json --noEmit`,
        },
        ...rxjsNoEmitSteps(tool),
      ],
      eslint: [
        {
          cwd: "packages/observable",
          cmd: `yarn --ignore-engines exec eslint --no-ignore ${tsconfigFiles("tsconfig.json")}`,
        },
        {
          cwd: "packages/rxjs",
          cmd: `yarn --ignore-engines exec eslint --no-ignore ${tsconfigFiles(rxjsSourceTsconfigs())}`,
        },
      ],
      format: {
        legacy: [
          {
            cwd: "packages/observable",
            cmd: `yarn --ignore-engines exec prettier --check --ignore-path /dev/null ${tsconfigFiles("tsconfig.json")}`,
          },
          {
            cwd: "packages/rxjs",
            cmd: `yarn --ignore-engines exec prettier --check --ignore-path /dev/null ${tsconfigFiles(rxjsSourceTsconfigs())}`,
          },
        ],
        ttscLint: [
          {
            cwd: "packages/observable",
            cmd: "yarn --ignore-engines exec ttsc -- format -p tsconfig.json",
          },
          {
            cwd: "packages/rxjs",
            cmd: "yarn --ignore-engines exec ttsc -- format -p ./src/tsconfig.cjs.json",
          },
          {
            cwd: "packages/rxjs",
            cmd: "yarn --ignore-engines exec ttsc -- format -p ./src/tsconfig.esm.json",
          },
          {
            cwd: "packages/rxjs",
            cmd: "yarn --ignore-engines exec ttsc -- format -p ./src/tsconfig.types.json",
          },
        ],
      },
    }),
  },
  "type-fest": {
    kind: "type-level library",
    repoName: "ttsc-benchmark-type-fest",
    repo: "https://github.com/samchon/ttsc-benchmark-type-fest.git",
    packageManager: "pnpm",
    filesRoot: ".",
    commands: compilerCommands({
      build: (tool) => [
        {
          cmd: `pnpm exec ${tool} -p tsconfig.json`,
          env: { NODE_OPTIONS: "--max-old-space-size=6144" },
        },
      ],
      noEmit: (tool) => [
        {
          cmd: `pnpm exec ${tool} -p tsconfig.json --noEmit`,
          env: { NODE_OPTIONS: "--max-old-space-size=6144" },
        },
      ],
      eslint: [
        `pnpm exec eslint --no-ignore --quiet ${tsconfigFiles("tsconfig.json")}`,
      ],
      format: {
        legacy: [
          `pnpm exec prettier --check --ignore-path /dev/null ${tsconfigFiles("tsconfig.json")}`,
        ],
        ttscLint: [
          {
            cmd: "pnpm exec ttsc format -p tsconfig.json",
            env: { NODE_OPTIONS: "--max-old-space-size=6144" },
          },
        ],
      },
    }),
  },
  typeorm: {
    kind: "ORM library",
    repoName: "ttsc-benchmark-typeorm",
    repo: "https://github.com/samchon/ttsc-benchmark-typeorm.git",
    packageManager: "pnpm",
    installCommand:
      "pnpm install --virtual-store-dir node_modules/.pnpm --no-frozen-lockfile --ignore-scripts --config.minimumReleaseAge=0",
    installTarballsCommand: (specs) =>
      `pnpm add -w --virtual-store-dir node_modules/.pnpm -D --ignore-scripts --config.minimumReleaseAge=0 ${specs}`,
    prepareCommand: "pnpm exec ttsc prepare -p tsconfig.json",
    filesRoot: "src",
    commands: compilerCommands({
      build: (tool) => [`pnpm exec ${tool} -p tsconfig.json`],
      noEmit: (tool) => [`pnpm exec ${tool} -p tsconfig.json --noEmit`],
      eslint: [
        `pnpm exec eslint --no-ignore --quiet ${tsconfigFiles("tsconfig.json")}`,
      ],
      format: {
        legacy: [
          `pnpm exec prettier --check --ignore-path /dev/null ${tsconfigFiles("tsconfig.json")}`,
        ],
        ttscLint: ["pnpm exec ttsc format -p tsconfig.json"],
      },
    }),
  },
  zod: {
    kind: "schema library monorepo",
    repoName: "ttsc-benchmark-zod",
    repo: "https://github.com/samchon/ttsc-benchmark-zod.git",
    packageManager: "pnpm",
    filesRoot: "packages/zod/src",
    commands: compilerCommands({
      build: (tool) => [
        {
          cwd: "packages/zod",
          cmd: `pnpm exec ${tool} -p tsconfig.build.json`,
        },
      ],
      noEmit: (tool) => [
        {
          cwd: "packages/zod",
          cmd: `pnpm exec ${tool} -p tsconfig.json --noEmit`,
        },
      ],
      eslint: [
        {
          cwd: "packages/zod",
          cmd: `pnpm exec eslint --no-ignore ${tsconfigFiles("tsconfig.json")}`,
        },
      ],
      format: {
        legacy: [
          {
            cwd: "packages/zod",
            cmd: `pnpm exec prettier --check --ignore-path /dev/null ${tsconfigFiles("tsconfig.json")}`,
          },
        ],
        ttscLint: [
          {
            cwd: "packages/zod",
            cmd: "pnpm exec ttsc format -p tsconfig.json",
          },
        ],
      },
    }),
  },
  nestjs: {
    kind: "backend framework monorepo",
    repoName: "ttsc-benchmark-nestjs",
    repo: "https://github.com/samchon/ttsc-benchmark-nestjs.git",
    packageManager: "npm",
    filesRoot: "packages",
    commands: nestjsCommands(),
  },
  vscode: {
    kind: "application monorepo",
    repoName: "ttsc-benchmark-vscode",
    repo: "https://github.com/samchon/ttsc-benchmark-vscode.git",
    packageManager: "npm",
    installCommand: "npm install --legacy-peer-deps --ignore-scripts",
    installTarballsCommand: (specs) =>
      `npm install --legacy-peer-deps --ignore-scripts --save-dev ${specs}`,
    prepareCommand: "./node_modules/.bin/ttsc prepare -p src/tsconfig.json",
    filesRoot: "src",
    commands: compilerCommands({
      build: (tool) => [
        {
          cmd: `./node_modules/.bin/${tool} -p src/tsconfig.json`,
          env: { NODE_OPTIONS: "--max-old-space-size=8192" },
        },
      ],
      noEmit: (tool) => [
        {
          cmd: `./node_modules/.bin/${tool} -p src/tsconfig.json --noEmit`,
          env: { NODE_OPTIONS: "--max-old-space-size=8192" },
        },
      ],
      eslint: [
        `./node_modules/.bin/eslint --no-ignore --quiet ${tsconfigFiles("src/tsconfig.json")}`,
      ],
      format: {
        legacy: [
          `./node_modules/.bin/prettier --check --ignore-path /dev/null ${tsconfigFiles("src/tsconfig.json")}`,
        ],
        ttscLint: [
          {
            cmd: "./node_modules/.bin/ttsc format -p src/tsconfig.json",
            env: { NODE_OPTIONS: "--max-old-space-size=8192" },
          },
        ],
      },
    }),
  },
  "shopping-backend": {
    kind: "plugin-heavy service",
    repoName: "shopping-backend",
    repo: "https://github.com/samchon/shopping-backend.git",
    packageManager: "pnpm",
    filesRoot: "src",
    installCommand: "pnpm install --ignore-scripts --no-frozen-lockfile",
    installTarballsCommand: (specs) =>
      `pnpm add -w -D --ignore-scripts --config.minimumReleaseAge=0 ${specs}`,
    prerequisites: normalizeSteps([
      {
        cmd: "pnpm run build:prisma",
        env: { TS_NODE_TRANSPILE_ONLY: "1" },
      },
      {
        cmd: 'pnpm exec prettier --write --ignore-path /dev/null "src/prisma/**/*.ts"',
      },
    ]),
    cleanExcludes: [".env", "src/prisma", "src/prisma/**"],
    commands: {
      legacy: {
        build: normalizeSteps(["pnpm exec tsc -p tsconfig.json"]),
        noEmit: normalizeSteps(["pnpm exec tsc -p tsconfig.json --noEmit"]),
        eslint: normalizeSteps([
          `pnpm exec eslint --no-ignore ${tsconfigFiles("tsconfig.json")}`,
        ]),
        format: normalizeSteps([
          `pnpm exec prettier --check --ignore-path /dev/null ${tsconfigFiles("tsconfig.json")}`,
        ]),
      },
      ttsc: {
        build: normalizeSteps(["pnpm exec ttsc -p tsconfig.json"]),
        noEmit: normalizeSteps(["pnpm exec ttsc -p tsconfig.json --noEmit"]),
      },
      "ttsc-lint": {
        build: normalizeSteps(["pnpm exec ttsc -p tsconfig.json"]),
        noEmit: normalizeSteps(["pnpm exec ttsc -p tsconfig.json --noEmit"]),
        format: normalizeSteps(["pnpm exec ttsc format -p tsconfig.json"]),
      },
    },
  },
};

// Display fixtures by upstream GitHub stars (checked 2026-05-24), so the
// dashboard starts with the projects readers are most likely to recognize.
const PROJECT_ORDER_BY_STARS = [
  "vscode",
  "nestjs",
  "vue",
  "zod",
  "typeorm",
  "rxjs",
  "type-fest",
  "shopping-backend",
];

const PROJECTS = Object.entries(PACKAGE_CONFIGS)
  .filter(([, config]) => !config.disabled)
  .map(([name, config]) => ({
    name,
    ...config,
  }))
  .sort((a, b) => projectSortRank(a.name) - projectSortRank(b.name));

function projectSortRank(name) {
  const index = PROJECT_ORDER_BY_STARS.indexOf(name);
  return index === -1 ? PROJECT_ORDER_BY_STARS.length : index;
}

const projectSelection = [...projectArgs, ...positional];
const wantedProjects = projectSelection.length
  ? projectSelection.map(resolveProjectArg).filter(Boolean)
  : PROJECTS;

if (flags.has("--list")) {
  printConfig();
  process.exit(0);
}
if (
  projectSelection.length &&
  wantedProjects.length !== projectSelection.length
) {
  const known = PROJECTS.map((p) => `${p.name} (${p.repoName})`).join(", ");
  throw new Error(`unknown project selection. Known: ${known}`);
}

function parseCliArgs(args) {
  const parsedCellFilters = [];
  const parsedFlags = new Set();
  const parsedProjects = [];
  const parsedPositional = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--project") {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error("--project requires a project name");
      parsedProjects.push(...splitProjectList(value));
    } else if (arg.startsWith("--project=")) {
      const value = arg.slice("--project=".length);
      if (!value) throw new Error("--project requires a project name");
      parsedProjects.push(...splitProjectList(value));
    } else if (arg === "--cell-filter") {
      const value = args[++i];
      if (!value || value.startsWith("--"))
        throw new Error("--cell-filter requires a regular expression");
      parsedCellFilters.push(new RegExp(value));
    } else if (arg.startsWith("--cell-filter=")) {
      const value = arg.slice("--cell-filter=".length);
      if (!value)
        throw new Error("--cell-filter requires a regular expression");
      parsedCellFilters.push(new RegExp(value));
    } else if (arg.startsWith("--")) {
      parsedFlags.add(arg);
    } else {
      parsedPositional.push(arg);
    }
  }
  return {
    cellFilters: parsedCellFilters,
    flags: parsedFlags,
    projectArgs: parsedProjects,
    positional: parsedPositional,
  };
}

function splitProjectList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

main();

function numberEnv(name, fallback, options = {}) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || (!options.allowZero && n === 0))
    throw new Error(
      options.allowZero
        ? `${name} must be zero or positive`
        : `${name} must be positive`,
    );
  return n;
}

function packageVersion(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"))
      .version;
  } catch {
    return undefined;
  }
}

function readNativePreviewLockVersion(repoRoot) {
  try {
    const file = fs.readFileSync(path.join(repoRoot, "pnpm-lock.yaml"), "utf8");
    const match = file.match(
      /^\s*'@typescript\/native-preview':\n\s+specifier:\s+[^\n]+\n\s+version:\s+([^\s#]+)\s*$/m,
    );
    if (match) return match[1].replace(/^['"]|['"]$/g, "");
  } catch {
    // Fall through.
  }
  return undefined;
}

function readNativePreviewWorkspaceCatalogVersion(repoRoot) {
  try {
    const file = fs.readFileSync(
      path.join(repoRoot, "pnpm-workspace.yaml"),
      "utf8",
    );
    const match = file.match(
      /^\s*'@typescript\/native-preview':\s*([^\s#]+)\s*$/m,
    );
    if (match) return match[1].replace(/^['"]|['"]$/g, "");
  } catch {
    // Fall through.
  }
  return undefined;
}

function compilerCommands({ build, noEmit, eslint, format }) {
  const legacy = {
    build: normalizeSteps(build("tsc")),
    noEmit: normalizeSteps(noEmit("tsc")),
    eslint: normalizeSteps(eslint),
  };
  if (format?.legacy?.length) legacy.format = normalizeSteps(format.legacy);
  const ttscLint = {
    build: normalizeSteps(build("ttsc")),
    noEmit: normalizeSteps(noEmit("ttsc")),
  };
  if (format?.ttscLint?.length)
    ttscLint.format = normalizeSteps(format.ttscLint);
  return {
    legacy,
    ttsc: {
      build: normalizeSteps(build("ttsc")),
      noEmit: normalizeSteps(noEmit("ttsc")),
    },
    "ttsc-lint": ttscLint,
  };
}

function rxjsNoEmitSteps(tool) {
  return rxjsSourceTsconfigs().map((config) => ({
    cwd: "packages/rxjs",
    cmd: `yarn --ignore-engines exec ${tool} -- -p ${config} --noEmit`,
  }));
}

function rxjsBuildSteps(tool) {
  return rxjsSourceTsconfigs().map((config) => ({
    cwd: "packages/rxjs",
    cmd: `yarn --ignore-engines exec ${tool} -- -p ${config}`,
  }));
}

function rxjsSourceTsconfigs() {
  return [
    "./src/tsconfig.cjs.json",
    "./src/tsconfig.esm.json",
    "./src/tsconfig.types.json",
  ];
}

function nestjsCommands() {
  const configs = nestjsPackageTsconfigs();
  return {
    legacy: {
      build: normalizeSteps(nestjsPackageSteps("tsc", false)),
      noEmit: normalizeSteps(nestjsPackageSteps("tsc", true)),
      eslint: normalizeSteps([
        `npm exec -- eslint --no-ignore ${tsconfigFiles(configs)}`,
      ]),
      format: normalizeSteps([
        `npm exec -- prettier --check --ignore-path /dev/null ${tsconfigFiles(configs)}`,
      ]),
    },
    ttsc: {
      build: normalizeSteps(nestjsPackageSteps("ttsc", false)),
      noEmit: normalizeSteps(nestjsPackageSteps("ttsc", true)),
    },
    "ttsc-lint": {
      build: normalizeSteps(nestjsPackageSteps("ttsc", false)),
      noEmit: normalizeSteps(nestjsPackageSteps("ttsc", true)),
      format: normalizeSteps(
        nestjsPackageSteps("ttsc", false).map((step) => ({
          ...step,
          cmd: step.cmd.replace(/\bttsc\b -p/, "ttsc format -p"),
        })),
      ),
    },
  };
}

function nestjsPackageSteps(tool, noEmit) {
  return nestjsPackageTsconfigs().map((config) => ({
    cmd: `npm exec -- ${tool} -p ${config}` + (noEmit ? " --noEmit" : ""),
  }));
}

function nestjsPackageTsconfigs() {
  return [
    "common",
    "core",
    "microservices",
    "platform-express",
    "platform-fastify",
    "platform-socket.io",
    "platform-ws",
    "testing",
    "websockets",
  ].map((pkg) => `packages/${pkg}/tsconfig.build.json`);
}

function tsconfigFiles(projects) {
  const list = Array.isArray(projects) ? projects : [projects];
  const args = list.map((project) => `-p ${quote(project)}`).join(" ");
  return `$(node ${TSCONFIG_FILES} ${args} --shell)`;
}

function normalizeSteps(value) {
  const array = Array.isArray(value) ? value : [value];
  return array.map((entry) =>
    typeof entry === "string" ? { cmd: entry } : { ...entry },
  );
}

function resolveProjectArg(arg) {
  return PROJECTS.find((p) => p.name === arg || p.repoName === arg);
}

function cloneDir(project, branch) {
  return path.join(WORK, `${project.repoName}@${branch}`);
}

function ownsPnpmWorkspace(root) {
  return fs.existsSync(path.join(root, "pnpm-workspace.yaml"));
}

function ensurePnpmWorkspaceBoundary(project, root) {
  if (project.packageManager !== "pnpm") return;
  const workspaceFile = path.join(root, "pnpm-workspace.yaml");
  if (fs.existsSync(workspaceFile)) return;
  fs.writeFileSync(workspaceFile, GENERATED_PNPM_WORKSPACE);
}

function pnpmProjectCommand(root, command) {
  if (ownsPnpmWorkspace(root)) return `pnpm ${command}`;
  const [verb, ...rest] = command.split(/\s+/);
  if (verb === "install" || verb === "add") {
    return `pnpm --ignore-workspace ${verb} --virtual-store-dir node_modules/.pnpm ${rest.join(" ")}`.trim();
  }
  return `pnpm --ignore-workspace ${command}`;
}

function commandForProject(cmd, root) {
  if (!/^pnpm\b/.test(cmd) || ownsPnpmWorkspace(root)) return cmd;
  if (/^pnpm\s+--ignore-workspace\b/.test(cmd)) return cmd;
  return cmd.replace(/^pnpm\b/, "pnpm --ignore-workspace");
}

function hrtimeMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function formatDuration(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`;
}

function timePhase(label, task) {
  const start = process.hrtime.bigint();
  if (VERBOSE) process.stdout.write(`[timer] start ${label}\n`);
  try {
    const result = task();
    process.stdout.write(
      `[timer] done ${label} in ${formatDuration(hrtimeMs(start))}\n`,
    );
    return result;
  } catch (error) {
    process.stdout.write(
      `[timer] fail ${label} after ${formatDuration(hrtimeMs(start))}\n`,
    );
    throw error;
  }
}

function sh(cmd, cwd, options = {}) {
  const start = process.hrtime.bigint();
  const label = options.label ?? cmd;
  // Default: capture child stdio so the progress stream stays at the milestone
  // level (timePhase summaries + short status lines). `--verbose` inherits so
  // AI/debug runs see installs, packs, and per-step output live. `quiet: true`
  // forces capture regardless — for callers that read stdout themselves
  // (git status, git branch --show-current, etc.).
  const inherit = VERBOSE && !options.quiet;
  if (VERBOSE && options.timing !== false)
    process.stdout.write(`[cmd] start ${label}\n`);
  const res = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: inherit ? "inherit" : "pipe",
  });
  if (VERBOSE && options.timing !== false)
    process.stdout.write(
      `[cmd] done ${label} in ${formatDuration(hrtimeMs(start))} ` +
        `(exit ${res.status})\n`,
    );
  if (options.check !== false && res.status !== 0) {
    // In quiet mode the captured streams are the only record of why this
    // failed — replay them to stderr before throwing.
    if (!inherit) {
      if (res.stdout) process.stderr.write(res.stdout);
      if (res.stderr) process.stderr.write(res.stderr);
    }
    throw new Error(`command failed (${res.status}) in ${cwd}: ${cmd}`);
  }
  return res;
}

function runSteps(steps, root) {
  const t0 = process.hrtime.bigint();
  let log = "";
  for (const step of steps) {
    const cwd = path.resolve(root, step.cwd ?? ".");
    const cmd = commandForProject(step.cmd, root);
    const stepStart = process.hrtime.bigint();
    if (VERBOSE)
      process.stdout.write(
        `    [step] start ${path.relative(root, cwd) || "."}: ${cmd}\n`,
      );
    // Always pipe so classifyFailure() can inspect the combined output for
    // race markers. In --verbose we tee to the parent streams so the user
    // still sees the live transcript.
    const res = spawnSync(cmd, {
      cwd,
      shell: true,
      encoding: "utf8",
      env: step.env ? { ...process.env, ...step.env } : process.env,
    });
    if (VERBOSE) {
      if (res.stdout) process.stdout.write(res.stdout);
      if (res.stderr) process.stderr.write(res.stderr);
      process.stdout.write(
        `    [step] done ${path.relative(root, cwd) || "."}: ` +
          `${formatDuration(hrtimeMs(stepStart))} (exit ${res.status})\n`,
      );
    }
    log += `$ ${cmd}\n${res.stdout ?? ""}${res.stderr ?? ""}`;
    if (res.status !== 0) {
      const t1 = process.hrtime.bigint();
      return {
        ok: false,
        status: res.status,
        ms: Number(t1 - t0) / 1e6,
        log,
      };
    }
  }
  const t1 = process.hrtime.bigint();
  return { ok: true, status: 0, ms: Number(t1 - t0) / 1e6, log };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function classifyFailure(log) {
  return /concurrent map|fatal error|\bpanic:|DATA RACE/.test(log)
    ? "race"
    : "error";
}

function isLintOp(op) {
  return op === "build" || op === "noEmit";
}

function parseTtscLintSidecarTimingMs(log) {
  const pattern = /^ttsc check plugin @ttsc\/lint time:\s*([0-9.]+)s\s*$/gm;
  return parseSummedTimingMs(log, pattern);
}

function parseTtscLintPluginTimingMs(log) {
  const pattern = /^@ttsc\/lint time:\s*([0-9.]+)s\s*$/gm;
  return parseSummedTimingMs(log, pattern);
}

function parseTtscTransformHostTimingMs(log) {
  const pattern = /^ttsc transform host \[[^\]]*] time:\s*([0-9.]+)s\s*$/gm;
  return parseSummedTimingMs(log, pattern);
}

function parseSummedTimingMs(log, pattern) {
  let total = 0;
  let count = 0;
  for (const match of log.matchAll(pattern)) {
    const seconds = Number(match[1]);
    if (Number.isFinite(seconds)) {
      total += seconds * 1000;
      count++;
    }
  }
  return count === 0 ? undefined : total;
}

function packTarballs() {
  if (flags.has("--no-pack") || process.env.TTSC_BENCH_SKIP_PACK === "1") {
    process.stdout.write(`Skipping tarball pack; using ${TGZ}\n`);
    return;
  }
  timePhase(`pack local ttsc tarballs into ${TGZ}`, () => {
    fs.mkdirSync(TGZ, { recursive: true });
    sh("pnpm run build:current", REPO_ROOT, { label: "build current ttsc" });
    for (const target of LOCAL_TARBALLS) {
      const out = path.join(TGZ, target.file);
      fs.rmSync(out, { force: true });
      sh(`pnpm pack --out ${quote(out)}`, path.join(REPO_ROOT, target.dir), {
        label: `pack ${target.name}`,
      });
    }
  });
}

function setupClone(project, branch) {
  return timePhase(`setup ${project.repoName}@${branch}`, () => {
    const dir = cloneDir(project, branch);
    fs.mkdirSync(WORK, { recursive: true });
    if (!fs.existsSync(dir)) {
      process.stdout.write(`Cloning ${project.repoName}@${branch}\n`);
      sh(
        `git clone --branch ${quote(branch)} ${quote(project.repo)} ${quote(dir)}`,
        WORK,
        { quiet: true, label: `clone ${project.repoName}@${branch}` },
      );
    } else if (!fs.existsSync(path.join(dir, ".git"))) {
      throw new Error(`${dir} exists but is not a git clone`);
    }

    const current = sh("git branch --show-current", dir, {
      quiet: true,
      check: false,
      timing: false,
    }).stdout?.trim();
    if (current && current !== branch) {
      const dirty = sh("git status --short", dir, {
        quiet: true,
        check: false,
        timing: false,
      }).stdout;
      if (dirty.trim()) {
        throw new Error(
          `${dir} is on ${current}, expected ${branch}, and has local changes`,
        );
      }
      sh(`git checkout ${quote(branch)}`, dir, {
        quiet: true,
        label: `checkout ${project.repoName}@${branch}`,
      });
    }
    cleanupBenchmarkWorktree(dir, project);
    ensurePnpmWorkspaceBoundary(project, dir);

    if (!flags.has("--no-install")) installIfNeeded(project, dir, branch);

    if (branch === "ttsc" || branch === "ttsc-lint") {
      const pm = project.packageManager;
      const cmd = project.prepareCommand
        ? commandForProject(project.prepareCommand, dir)
        : pm === "npm"
          ? "npm exec -- ttsc prepare"
          : pm === "pnpm"
            ? pnpmProjectCommand(dir, "exec ttsc prepare")
            : `${pm} exec ttsc prepare`;
      const res = sh(cmd, dir, {
        quiet: true,
        check: false,
        label: `ttsc prepare ${project.repoName}@${branch}`,
      });
      if (res.status !== 0) {
        process.stdout.write(
          `${project.repoName}@${branch}: ttsc prepare exited ${res.status}; ` +
            `continuing only if this project has no source plugins\n`,
        );
      }
    }

    for (const step of normalizeSteps(project.prerequisites ?? [])) {
      process.stdout.write(
        `${project.repoName}@${branch}: prerequisite ${step.cmd}\n`,
      );
      sh(step.cmd, path.resolve(dir, step.cwd ?? "."), {
        env: step.env ? { ...process.env, ...step.env } : process.env,
        quiet: true,
        label: `prerequisite ${project.repoName}@${branch}`,
      });
    }
  });
}

function installIfNeeded(project, dir, branch) {
  return timePhase(`install ${path.basename(dir)}`, () => {
    const mustRefreshTarballs = branch === "ttsc" || branch === "ttsc-lint";
    const hasNodeModules = fs.existsSync(path.join(dir, "node_modules"));
    if (
      !mustRefreshTarballs &&
      !flags.has("--force-install") &&
      hasNodeModules
    ) {
      process.stdout.write(
        `Reusing installed node_modules in ${path.basename(dir)}\n`,
      );
      return;
    }
    const pm = project.packageManager;
    if (mustRefreshTarballs) assertLocalTarballs(branch);
    const cmd =
      project.installCommand ??
      (pm === "pnpm"
        ? pnpmProjectCommand(
            dir,
            "install --no-frozen-lockfile --config.minimumReleaseAge=0",
          )
        : pm === "yarn"
          ? "YARN_CACHE_FOLDER=.yarn-cache yarn install --ignore-engines --update-checksums"
          : "npm install --legacy-peer-deps");
    if (!hasNodeModules || flags.has("--force-install")) {
      process.stdout.write(`Installing ${path.basename(dir)} with ${pm}\n`);
      const install = () =>
        sh(cmd, dir, { label: `install dependencies ${path.basename(dir)}` });
      if (mustRefreshTarballs) {
        withDependencyFileSnapshot(dir, () => {
          scrubLocalTarballInstallState(dir, localTarballTargets(branch));
          install();
        });
      } else {
        install();
      }
    } else {
      process.stdout.write(
        `Reusing installed node_modules in ${path.basename(dir)}\n`,
      );
    }
    if (mustRefreshTarballs) installLocalTarballs(project, dir, branch);
    if (mustRefreshTarballs && !hasPinnedNativePreviewRuntimeDeps(dir)) {
      installPinnedNativePreviewRuntimeDeps(project, dir, branch);
    }
  });
}

function assertLocalTarballs(branch) {
  const missing = localTarballPaths(branch).filter(
    (file) => !fs.existsSync(file),
  );
  if (missing.length) {
    throw new Error(
      "missing local ttsc tarballs; run without --no-pack or populate " +
        `${TGZ}\n${missing.map((file) => `- ${file}`).join("\n")}`,
    );
  }
}

function localTarballTargets(branch) {
  return LOCAL_TARBALLS.filter(
    (target) => branch === "ttsc-lint" || target.name !== "@ttsc/lint",
  );
}

function localTarballPaths(branch) {
  return localTarballTargets(branch).map((target) =>
    path.join(TGZ, target.file),
  );
}

function installLocalTarballs(project, dir, branch) {
  return timePhase(`install local tarballs ${path.basename(dir)}`, () => {
    withDependencyFileSnapshot(dir, () => {
      const targets = localTarballTargets(branch);
      scrubLocalTarballInstallState(dir, targets);
      if (project.packageManager === "yarn") {
        materializeLocalTarballs(targets, dir);
        return;
      }
      const specs = targets
        .map((target) => quote(path.join(TGZ, target.file)))
        .join(" ");
      const pm = project.packageManager;
      // `--config.minimumReleaseAge=0` keeps the just-bumped ttsc release from
      // tripping a fixture's npm-hygiene policy. The vue workspace pins
      // `minimumReleaseAge: 1440` (24 h) in its `pnpm-workspace.yaml`; without
      // the override pnpm refuses to resolve `optionalDependencies` like
      // `@ttsc/win32-x64@0.13.0` for ~24 h after publish and the local tarball
      // install fails. The bench is the publisher's own canonical signal, so
      // the policy carries no value here.
      const cmd =
        project.installTarballsCommand?.(specs) ??
        (pm === "pnpm"
          ? ownsPnpmWorkspace(dir)
            ? `pnpm add -w -D --config.minimumReleaseAge=0 ${specs}`
            : `pnpm add --ignore-workspace -D --config.minimumReleaseAge=0 ${specs}`
          : pm === "yarn"
            ? `YARN_CACHE_FOLDER=.yarn-cache yarn add --dev --force --update-checksums --ignore-engines --ignore-workspace-root-check ${specs}`
            : `npm install --legacy-peer-deps --save-dev ${specs}`);
      process.stdout.write(
        `Installing local tarballs into ${path.basename(dir)}: ` +
          `${targets.map((target) => target.name).join(", ")}\n`,
      );
      sh(cmd, dir, { label: `install local tarballs ${path.basename(dir)}` });
    });
  });
}

function withDependencyFileSnapshot(dir, fn) {
  const snapshot = snapshotDependencyFiles(dir);
  try {
    return fn();
  } finally {
    restoreDependencyFiles(snapshot);
  }
}

function snapshotDependencyFiles(dir) {
  const files = new Set(
    findProjectFiles(dir, [
      "package.json",
      "package-lock.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      "yarn.lock",
    ]),
  );
  for (const name of [
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "yarn.lock",
  ]) {
    files.add(path.join(dir, name));
  }
  return [...files].map((file) => {
    const exists = fs.existsSync(file);
    return {
      file,
      exists,
      content: exists ? fs.readFileSync(file, "utf8") : undefined,
    };
  });
}

function restoreDependencyFiles(snapshot) {
  for (const entry of snapshot) {
    if (entry.exists) {
      fs.mkdirSync(path.dirname(entry.file), { recursive: true });
      fs.writeFileSync(entry.file, entry.content);
    } else {
      fs.rmSync(entry.file, { force: true });
    }
  }
}

function scrubLocalTarballInstallState(dir, targets) {
  const specs = Object.fromEntries(
    targets.map((target) => [
      target.name,
      `file:${path.join(TGZ, target.file)}`,
    ]),
  );
  for (const packageJson of findProjectFiles(dir, "package.json")) {
    rewritePackageJsonTarballs(packageJson, specs);
  }
  for (const workspaceFile of findProjectFiles(dir, "pnpm-workspace.yaml")) {
    rewriteTextTarballs(workspaceFile, targets);
  }
  for (const lockfile of findProjectFiles(dir, [
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
  ])) {
    const text = fs.readFileSync(lockfile, "utf8");
    if (text.includes("ttsc-tgz")) fs.rmSync(lockfile);
  }
  const pnpmStoreLockfile = path.join(
    dir,
    "node_modules",
    ".pnpm",
    "lock.yaml",
  );
  fs.rmSync(pnpmStoreLockfile, { force: true });
}

function findProjectFiles(root, names) {
  const wanted = new Set(Array.isArray(names) ? names : [names]);
  const skip = new Set([".git", "node_modules", "dist", "lib", "out"]);
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (wanted.has(entry.name)) {
        files.push(path.join(dir, entry.name));
      }
    }
  };
  walk(root);
  return files;
}

function rewritePackageJsonTarballs(file, specs) {
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  let changed = false;
  const rewriteMap = (map) => {
    if (!map || typeof map !== "object") return;
    for (const [name, spec] of Object.entries(specs)) {
      const current = map[name];
      if (typeof current === "string" && current.includes("ttsc-tgz")) {
        map[name] = spec;
        changed = true;
      }
    }
  };
  for (const key of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
    "overrides",
    "resolutions",
  ]) {
    rewriteMap(manifest[key]);
  }
  rewriteMap(manifest.pnpm?.overrides);
  if (changed) fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + "\n");
}

function rewriteTextTarballs(file, targets) {
  let text = fs.readFileSync(file, "utf8");
  let changed = false;
  // Match any historical ttsc tarball reference for this target — not just
  // the current `{stem}-{TTSC_VERSION}.tgz` file name. After a version bump
  // (e.g. 0.12.4 -> 0.13.0) the pack pid changes and the new tarball ships
  // under a new file name, so a stale `pnpm-workspace.yaml` override left
  // by an earlier prepared clone (the vue fixture pins
  // `'@ttsc/linux-x64'` through `overrides`) would otherwise survive the
  // scrub and pnpm would fail to open the now-deleted `/tmp/ttsc-tgz-OLD/`
  // path with ENOENT (exit 254). Pin the stem so `ttsc-` and
  // `ttsc-linux-x64-` do not cross-rewrite.
  for (const target of targets) {
    const stem = target.file.replace(/-\d+\.\d+\.\d+\.tgz$/, "");
    const pattern = new RegExp(
      `(?:file:)?[^\\s'",}]*ttsc-tgz[^\\s'",}]*/${escapeRegExp(stem)}-\\d+\\.\\d+\\.\\d+\\.tgz`,
      "g",
    );
    const next = text.replace(pattern, `file:${path.join(TGZ, target.file)}`);
    if (next !== text) {
      text = next;
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(file, text);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function materializeLocalTarballs(targets, dir) {
  const nodeModules = path.join(dir, "node_modules");
  fs.mkdirSync(nodeModules, { recursive: true });
  fs.mkdirSync(path.join(nodeModules, ".bin"), { recursive: true });
  for (const target of targets) {
    const packageDir = path.join(nodeModules, ...target.name.split("/"));
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-bench-tgz-"));
    fs.rmSync(packageDir, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(packageDir), { recursive: true });
    sh(`tar -xzf ${quote(path.join(TGZ, target.file))} -C ${quote(tmp)}`, dir, {
      quiet: true,
    });
    fs.cpSync(path.join(tmp, "package"), packageDir, { recursive: true });
    fs.rmSync(tmp, { recursive: true, force: true });
    linkPackageBins(packageDir, nodeModules);
  }
  process.stdout.write(
    `Materialized local tarballs into ${path.basename(dir)}: ` +
      `${targets.map((target) => target.name).join(", ")}\n`,
  );
}

function linkPackageBins(packageDir, nodeModules) {
  const packageJson = path.join(packageDir, "package.json");
  if (!fs.existsSync(packageJson)) return;
  const manifest = JSON.parse(fs.readFileSync(packageJson, "utf8"));
  const bins =
    typeof manifest.bin === "string"
      ? { [manifest.name]: manifest.bin }
      : manifest.bin;
  if (!bins || typeof bins !== "object") return;
  const binDir = path.join(nodeModules, ".bin");
  for (const [name, bin] of Object.entries(bins)) {
    const link = path.join(binDir, name);
    const target = path.relative(binDir, path.join(packageDir, bin));
    fs.rmSync(link, { force: true });
    fs.symlinkSync(target, link);
  }
}

function installPinnedNativePreviewRuntimeDeps(project, dir, branch) {
  const specs = [
    `@typescript/native-preview@${NATIVE_PREVIEW_VERSION}`,
    `${NATIVE_PREVIEW_PLATFORM_PACKAGE}@${NATIVE_PREVIEW_VERSION}`,
  ]
    .map(quote)
    .join(" ");
  const pm = project.packageManager;
  // Mirror `installLocalTarballs` and bypass any fixture-side
  // `minimumReleaseAge` policy. The runtime dev tags publish on a daily-ish
  // cadence and the bench should always pin to whatever ttsc's workspace
  // resolves, not what an old enough mirror happens to expose.
  const cmd =
    pm === "pnpm"
      ? ownsPnpmWorkspace(dir)
        ? `pnpm add -w -D --config.minimumReleaseAge=0 ${specs}`
        : `pnpm add --ignore-workspace --virtual-store-dir node_modules/.pnpm -D --config.minimumReleaseAge=0 ${specs}`
      : pm === "yarn"
        ? `YARN_CACHE_FOLDER=.yarn-cache yarn add --dev --force --update-checksums --ignore-engines --ignore-workspace-root-check ${specs}`
        : `npm install --legacy-peer-deps --ignore-scripts --save-dev ${specs}`;
  process.stdout.write(
    `Installing pinned TypeScript-Go runtime deps into ${path.basename(dir)}: ` +
      `@typescript/native-preview@${NATIVE_PREVIEW_VERSION}, ` +
      `${NATIVE_PREVIEW_PLATFORM_PACKAGE}@${NATIVE_PREVIEW_VERSION}\n`,
  );
  withDependencyFileSnapshot(dir, () => {
    scrubLocalTarballInstallState(dir, localTarballTargets(branch));
    sh(cmd, dir);
  });
}

function hasPinnedNativePreviewRuntimeDeps(dir) {
  return (
    depVersion(dir, "@typescript/native-preview") === NATIVE_PREVIEW_VERSION &&
    depVersion(dir, NATIVE_PREVIEW_PLATFORM_PACKAGE) === NATIVE_PREVIEW_VERSION
  );
}

function quote(value) {
  return JSON.stringify(value);
}

function singleThreadedSteps(steps) {
  return steps.map((step) => {
    if (step.singleThreadedCmd) {
      const { singleThreadedCmd, ...rest } = step;
      return { ...rest, cmd: singleThreadedCmd };
    }
    if (!/\bttsc\b/.test(step.cmd) || /--singleThreaded\b/.test(step.cmd)) {
      return step;
    }
    return { ...step, cmd: `${step.cmd} --singleThreaded` };
  });
}

/**
 * Append `--checkers N` to every ttsc step in the cell. Used to sweep the
 * checker-pool size axis (2 / 4 / 8) replacing the previous binary single/multi
 * axis. Parse and the lint engine still run with the host's full CPU count;
 * only the type-checker pool is capped.
 */
function checkersSteps(steps, n) {
  return steps.map((step) => {
    if (!/\bttsc\b/.test(step.cmd) || /--checkers\b/.test(step.cmd)) {
      return step;
    }
    return { ...step, cmd: `${step.cmd} --checkers ${n}` };
  });
}

function diagnosticsSteps(steps) {
  return steps.map((step) => {
    if (
      !/\bttsc\b/.test(step.cmd) ||
      /--(?:extendedDiagnostics|diagnostics)\b/.test(step.cmd)
    ) {
      return step;
    }
    return { ...step, cmd: `${step.cmd} --diagnostics` };
  });
}

/**
 * Threading variants the bench measures for every ttsc / ttsc-lint cell. Order
 * is the spec the user asked for: serial baseline first, then the 2/4/8
 * checker-pool sweep, so the dashboard rows read left-to-right as `single →
 * checkers2 → checkers4 → checkers8`.
 *
 * Returned by a function rather than a top-level `const` so the call sites
 * (`projectCells`, invoked from `main()` near the top of the file) hit a
 * defined value — top-level statements run top-to-bottom, and `main();` is at
 * line ~414 while the variant helpers below sit past line 1000.
 */
function threadingVariants() {
  return [
    { name: "single", apply: (steps) => singleThreadedSteps(steps) },
    { name: "checkers2", apply: (steps) => checkersSteps(steps, 2) },
    { name: "checkers4", apply: (steps) => checkersSteps(steps, 4) },
    { name: "checkers8", apply: (steps) => checkersSteps(steps, 8) },
  ];
}

/**
 * Format does not consume the TypeScript-Go checker pool, so the checker sweep
 * would only repeat the same `ttsc format` workload under misleading labels.
 * Keep the meaningful formatter axis: serial execution vs the normal bare
 * command.
 */
function formatThreadingVariants() {
  return [
    { name: "single", apply: (steps) => singleThreadedSteps(steps) },
    { name: "multi", apply: (steps) => steps },
  ];
}

function measureCell({ id, project, branch, tool, op, threading, steps }) {
  const root = cloneDir(project, branch);
  process.stdout.write(`\n[${id}] ${RUNS} runs\n`);
  assertCleanBenchmarkWorktree(root, id, project);
  cleanupBenchmarkWorktree(root, project);

  const run = () => runBenchmarkSteps(steps, root, project);
  const capturesLintTiming = branch === "ttsc-lint" && isLintOp(op);

  for (let i = 0; i < WARMUP; i++) {
    const result = run();
    process.stdout.write(
      `  warmup ${i + 1}: ${result.ms.toFixed(0)} ms ` +
        (result.ok ? "ok" : `exit ${result.status}`) +
        "\n",
    );
    if (!result.ok && classifyFailure(result.log) === "error") {
      return failedMeasurement(
        project,
        branch,
        op,
        threading,
        result,
        0,
        id,
        tool,
      );
    }
  }

  const samples = [];
  const lintSidecarSamples = [];
  const lintPluginSamples = [];
  const transformHostSamples = [];
  let raceRetries = 0;
  let deterministic = null;
  for (let i = 0; i < RUNS; i++) {
    let result = run();
    let attempts = 0;
    while (!result.ok && attempts < RETRIES) {
      const kind = classifyFailure(result.log);
      if (kind === "error") break;
      raceRetries++;
      attempts++;
      process.stdout.write(`  run ${i + 1}: race retry ${attempts}\n`);
      result = run();
    }
    if (!result.ok) {
      deterministic = result;
      process.stdout.write(`  run ${i + 1}: exit ${result.status}\n`);
      break;
    }
    samples.push(result.ms);
    if (capturesLintTiming) {
      const lintSidecarMs = parseTtscLintSidecarTimingMs(result.log);
      if (lintSidecarMs !== undefined) lintSidecarSamples.push(lintSidecarMs);
      const lintPluginMs = parseTtscLintPluginTimingMs(result.log);
      if (lintPluginMs !== undefined) lintPluginSamples.push(lintPluginMs);
      const transformHostMs = parseTtscTransformHostTimingMs(result.log);
      if (transformHostMs !== undefined) {
        transformHostSamples.push(transformHostMs);
      }
    }
    process.stdout.write(`  run ${i + 1}: ${result.ms.toFixed(0)} ms\n`);
  }

  if (deterministic || samples.length === 0) {
    return failedMeasurement(
      project,
      branch,
      op,
      threading,
      deterministic ?? { status: 1, log: "no samples", ms: 0 },
      raceRetries,
      id,
      tool,
    );
  }

  const measured = {
    id,
    branch,
    tool: toolFor(branch, op, tool),
    op,
    threading,
    medianMs: median(samples),
    minMs: Math.min(...samples),
    samples,
    raceRetries: raceRetries || undefined,
  };
  if (capturesLintTiming && lintSidecarSamples.length !== 0) {
    measured.lintMedianMs = median(lintSidecarSamples);
    measured.lintMinMs = Math.min(...lintSidecarSamples);
    measured.lintSamples = lintSidecarSamples;
  }
  if (capturesLintTiming && lintPluginSamples.length !== 0) {
    measured.lintPluginMedianMs = median(lintPluginSamples);
    measured.lintPluginMinMs = Math.min(...lintPluginSamples);
    measured.lintPluginSamples = lintPluginSamples;
  }
  if (capturesLintTiming && transformHostSamples.length !== 0) {
    measured.transformHostMedianMs = median(transformHostSamples);
    measured.transformHostMinMs = Math.min(...transformHostSamples);
    measured.transformHostSamples = transformHostSamples;
  }
  return measured;
}

function runBenchmarkSteps(steps, root, project) {
  try {
    return runSteps(steps, root);
  } finally {
    cleanupBenchmarkWorktree(root, project);
  }
}

function assertCleanBenchmarkWorktree(root, id, project) {
  const status = benchmarkWorktreeStatus(root, project);
  if (!status.trim()) return;
  throw new Error(
    `${id} cannot start from a dirty benchmark worktree: ${root}\n${status}`,
  );
}

function cleanupBenchmarkWorktree(root, project) {
  sh("git restore --worktree .", root, {
    quiet: true,
    timing: false,
    label: `restore benchmark worktree ${path.basename(root)}`,
  });
  const excludes = [
    "node_modules",
    "**/node_modules",
    ".yarn-cache",
    ".pnpm-store",
    ".husky/_",
    "**/.husky/_",
    ...(project?.packageManager === "pnpm" ? ["pnpm-workspace.yaml"] : []),
    ...(project?.cleanExcludes ?? []),
  ];
  sh(
    `git clean -fdx ${excludes.map((pattern) => `-e ${quote(pattern)}`).join(" ")}`,
    root,
    {
      quiet: true,
      timing: false,
      label: `clean benchmark worktree ${path.basename(root)}`,
    },
  );
}

function benchmarkWorktreeStatus(root, project) {
  const status =
    sh("git status --short --untracked-files=normal", root, {
      quiet: true,
      check: false,
      timing: false,
    }).stdout ?? "";
  return status
    .split("\n")
    .filter((line) => line && !isAllowedBenchmarkDirtyLine(line, project))
    .join("\n");
}

function isAllowedBenchmarkDirtyLine(line, project) {
  const pathText = line.slice(3).trim();
  const paths = pathText.includes(" -> ")
    ? pathText.split(" -> ").map((part) => part.trim())
    : [pathText];
  return paths.every((file) => isAllowedBenchmarkDirtyPath(file, project));
}

function isAllowedBenchmarkDirtyPath(file, project) {
  const path = file.replace(/^"|"$/g, "").replace(/\/$/, "");
  const allowed = [
    "node_modules",
    ".yarn-cache",
    ".pnpm-store",
    ".husky/_",
    ...(project?.packageManager === "pnpm" ? ["pnpm-workspace.yaml"] : []),
    ...(project?.cleanExcludes ?? []),
  ];
  return allowed.some((pattern) => matchesBenchmarkDirtyPath(path, pattern));
}

function matchesBenchmarkDirtyPath(path, pattern) {
  const normalized = pattern.replace(/\/\*\*$/, "").replace(/\/$/, "");
  if (normalized === "**/node_modules") return path.includes("node_modules");
  if (normalized === "**/.husky/_") return path.endsWith(".husky/_");
  return path === normalized || path.startsWith(`${normalized}/`);
}

function failedMeasurement(
  project,
  branch,
  op,
  threading,
  result,
  raceRetries,
  id,
  tool,
) {
  return {
    id,
    branch,
    tool: toolFor(branch, op, tool),
    op,
    threading,
    medianMs: 0,
    samples: [],
    raceRetries: raceRetries || undefined,
    failure: classifyFailure(result.log),
    exitStatus: result.status,
  };
}

function toolFor(branch, op, tool) {
  if (tool) return tool;
  if (op === "eslint") return "eslint";
  if (op === "format") return branch === "legacy" ? "prettier" : "ttsc-format";
  if (branch === "legacy") return "tsc";
  return branch === "ttsc-lint" ? "ttsc+@ttsc/lint" : "ttsc";
}

function measureProject(project, report) {
  return timePhase(`measure project ${project.name}`, () => {
    const projectReport = ensureProjectReport(report, project);
    for (const cell of projectCells(project)) {
      const existingIndex = projectReport.measurements.findIndex(
        (measurement) => measurement.id === cell.id,
      );
      if (existingIndex !== -1)
        process.stdout.write(
          `\n[${cell.id}] refreshing existing measurement\n`,
        );
      const measurement = measureCell(cell);
      if (existingIndex === -1) projectReport.measurements.push(measurement);
      else projectReport.measurements.splice(existingIndex, 1, measurement);
      writeReports(report, { publishWebsite: true });
    }
  });
}

function ensureProjectReport(report, project) {
  let projectReport = report.projects.find((p) => p.name === project.name);
  if (!projectReport) {
    projectReport = projectReportFor(project, []);
    report.projects.push(projectReport);
  }
  return projectReport;
}

function projectReportFor(project, measurements) {
  return {
    name: project.name,
    repo: project.repoName,
    kind: project.kind,
    files: countSourceFiles(projectSourceRoot(project)),
    typescript: displayLegacyTypescriptVersion(
      depVersion(cloneDir(project, "legacy"), "typescript"),
    ),
    measurements,
  };
}

function projectSourceRoot(project) {
  for (const branch of projectBranches(project)) {
    const root = path.join(cloneDir(project, branch), project.filesRoot);
    if (fs.existsSync(root)) return root;
  }
  return path.join(cloneDir(project, "legacy"), project.filesRoot);
}

function countSourceFiles(root) {
  if (!fs.existsSync(root)) return 0;
  const skip = new Set([
    ".git",
    "node_modules",
    "dist",
    "lib",
    "out",
    "build",
    "coverage",
  ]);
  let count = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) walk(path.join(dir, entry.name));
      } else if (
        /\.(ts|tsx|mts|cts)$/.test(entry.name) &&
        !/\.d\.(ts|mts|cts)$/.test(entry.name)
      ) {
        count++;
      }
    }
  };
  walk(root);
  return count;
}

function hostSpec(projects) {
  const cpus = os.cpus();
  let osName = `${os.type()} ${os.release()}`;
  try {
    const pretty = fs
      .readFileSync("/etc/os-release", "utf8")
      .match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    if (pretty) osName = pretty[1];
  } catch {
    // Keep os.type/os.release fallback.
  }
  return {
    os: osName,
    kernel: os.release(),
    cpu: cpus[0]?.model?.trim() ?? "unknown",
    cores: cpus.length,
    ramGB: Math.round(os.totalmem() / 2 ** 30),
    node: process.version,
    ttsc: TTSC_VERSION,
    typescript: displayLegacyTypescriptVersion(
      commonDepVersion(projects, "legacy", "typescript"),
    ),
  };
}

function displayLegacyTypescriptVersion(version) {
  if (!version || version === "unknown") return version ?? "unknown";
  if (version === "varies by fixture") return version;
  if (version === "6.0.0-dev.20260416" || version === "6.0.3") {
    return LEGACY_TYPESCRIPT_DISPLAY_VERSION;
  }
  return version.startsWith("v") ? version : `v${version}`;
}

function commonDepVersion(projects, branch, name) {
  const versions = [
    ...new Set(
      projects
        .map((project) => depVersion(cloneDir(project, branch), name))
        .filter(Boolean),
    ),
  ];
  if (versions.length === 0) return "unknown";
  return versions.length === 1 ? versions[0] : "varies by fixture";
}

function depVersion(root, name) {
  try {
    return JSON.parse(
      fs.readFileSync(
        path.join(root, "node_modules", name, "package.json"),
        "utf8",
      ),
    ).version;
  } catch {
    return undefined;
  }
}

function buildMarkdown(report) {
  const lines = [];
  lines.push("# ttsc benchmark");
  lines.push("");
  lines.push(`- Date: ${report.date}`);
  lines.push(`- Runs: ${RUNS} measured + ${WARMUP} warmup per cell`);
  lines.push("");
  lines.push("## Host");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  for (const [key, value] of Object.entries(report.host)) {
    lines.push(`| ${key} | ${value} |`);
  }
  lines.push("");

  for (const project of report.projects) {
    lines.push(`## ${project.name}`);
    lines.push("");
    lines.push(
      "| Branch | Op | Threading | Median | @ttsc/lint sidecar | @ttsc/lint | Transform host | Samples | Failure |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const m of project.measurements) {
      lines.push(
        `| ${m.branch} | ${m.op} | ${m.threading} | ${formatMs(m.medianMs)} | ` +
          `${formatMs(m.lintMedianMs ?? 0)} | ` +
          `${formatMs(m.lintPluginMedianMs ?? 0)} | ` +
          `${formatMs(m.transformHostMedianMs ?? 0)} | ` +
          `${m.samples?.map((s) => s.toFixed(0)).join(", ") || "-"} | ` +
          `${m.failure ?? ""} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function formatMs(ms) {
  return ms > 0 ? `${(ms / 1000).toFixed(2)} s` : "-";
}

function createReport(projects) {
  const previous = flags.has("--reset") ? null : loadPreviousReport();
  const reusable =
    previous && Array.isArray(previous.projects) ? previous : null;
  const selected = new Set(projects.map((project) => project.name));
  const reports = new Map(
    (reusable?.projects ?? [])
      .filter((project) => project?.name && !selected.has(project.name))
      .map((project) => [project.name, project]),
  );
  for (const project of projects) {
    const old = reusable?.projects.find((p) => p.name === project.name);
    reports.set(
      project.name,
      projectReportFor(
        project,
        Array.isArray(old?.measurements) ? old.measurements : [],
      ),
    );
  }
  const orderedReports = [];
  for (const project of PROJECTS) {
    const report = reports.get(project.name);
    if (report) {
      orderedReports.push(report);
      reports.delete(project.name);
    }
  }
  orderedReports.push(...reports.values());
  return {
    date: new Date().toISOString(),
    runs: RUNS,
    warmup: WARMUP,
    host: hostSpec(projects),
    projects: orderedReports,
  };
}

function loadPreviousReport() {
  return (
    [WEBSITE_JSON, CHECKPOINT_JSON]
      .map((file) => ({ file, report: loadJson(file) }))
      .filter(({ report }) => report && Array.isArray(report.projects))
      .sort(
        (a, b) => measurementCount(b.report) - measurementCount(a.report),
      )[0]?.report ?? null
  );
}

function measurementCount(report) {
  return (report.projects ?? []).reduce(
    (sum, project) =>
      sum +
      (Array.isArray(project?.measurements) ? project.measurements.length : 0),
    0,
  );
}

function writeReports(report, { publishWebsite = false } = {}) {
  fs.writeFileSync(OUT, buildMarkdown(report) + "\n");
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(CHECKPOINT_JSON, JSON.stringify(report, null, 2) + "\n");
  if (publishWebsite && !flags.has("--no-website")) {
    fs.mkdirSync(path.dirname(WEBSITE_JSON), { recursive: true });
    const websiteReport = mergePreviousWebsiteMeasurements(report);
    fs.writeFileSync(
      WEBSITE_JSON,
      JSON.stringify(websiteReport, null, 2) + "\n",
    );
  }
}

function mergePreviousWebsiteMeasurements(report) {
  if (flags.has("--reset")) return report;
  const previous = loadJson(WEBSITE_JSON);
  if (!previous || !Array.isArray(previous.projects)) return report;

  const merged = JSON.parse(JSON.stringify(report));
  for (const project of merged.projects) {
    const oldProject = previous.projects.find((p) => p.name === project.name);
    if (!oldProject || !Array.isArray(oldProject.measurements)) continue;

    const freshById = new Map(
      project.measurements.map((measurement) => [measurement.id, measurement]),
    );
    const measurements = [];
    for (const oldMeasurement of oldProject.measurements) {
      if (isObsoleteMergedMeasurement(oldMeasurement)) continue;
      const fresh = freshById.get(oldMeasurement.id);
      if (fresh) {
        measurements.push(fresh);
        freshById.delete(oldMeasurement.id);
      } else {
        measurements.push(oldMeasurement);
      }
    }
    measurements.push(...freshById.values());
    project.measurements = measurements;
  }
  const existing = new Set(merged.projects.map((project) => project.name));
  for (const oldProject of previous.projects) {
    if (!existing.has(oldProject.name)) {
      merged.projects.push(pruneObsoleteMeasurements(oldProject));
    }
  }
  return merged;
}

function pruneObsoleteMeasurements(project) {
  return {
    ...project,
    measurements: (project.measurements ?? []).filter(
      (measurement) => !isObsoleteMergedMeasurement(measurement),
    ),
  };
}

function isObsoleteMergedMeasurement(measurement) {
  if (measurement.threading === "multi" && measurement.branch !== "legacy") {
    return measurement.op === "build" || measurement.op === "noEmit";
  }
  return (
    measurement.op === "format" &&
    /^(?:checkers2|checkers4|checkers8)$/.test(measurement.threading)
  );
}

function loadJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function printConfig() {
  for (const project of wantedProjects) {
    process.stdout.write(`${project.name}: ${project.repo}\n`);
    for (const cell of projectCells(project)) {
      const tool = cell.tool ?? toolFor(cell.branch, cell.op);
      const root = cloneDir(project, cell.branch);
      process.stdout.write(
        `  ${cell.branch}:${tool}:${cell.op}:${cell.threading}\n`,
      );
      for (const step of cell.steps) {
        const cmd = commandForProject(step.cmd, root);
        process.stdout.write(`    ${step.cwd ? `${step.cwd}: ` : ""}${cmd}\n`);
      }
    }
  }
}

function main() {
  const totalStart = process.hrtime.bigint();
  if (wantedProjects.length === 0)
    throw new Error("no benchmark projects selected");
  if (!wantedProjects.some((project) => projectCells(project).length !== 0))
    throw new Error("no benchmark cells selected");

  // Quiet-host gate. Short ttsc cells (build/noEmit) finish in 2–8 s
  // and a noisy host (concurrent claude worktrees, ts-node jobs, video
  // playback) can move a single sample by 30–60 %. The threshold is the
  // 1-minute load average per logical CPU: 0.5 is the rule of thumb above
  // which a publication-grade sweep starts to drift, anything past 1.0 is
  // already deep in CPU-steal territory. The check warns by default and
  // aborts when `TTSC_BENCH_REQUIRE_QUIET=1` so CI hosts can opt into the
  // strict mode without changing local quick-checks. Disable entirely via
  // `TTSC_BENCH_SKIP_LOAD_CHECK=1`.
  if (process.env.TTSC_BENCH_SKIP_LOAD_CHECK !== "1") {
    const cpuCount = Math.max(os.cpus().length, 1);
    const load1 = os.loadavg()[0];
    const ratio = load1 / cpuCount;
    if (ratio > 0.5) {
      const msg =
        `host load is high (1-min loadavg ${load1.toFixed(2)} on ` +
        `${cpuCount} CPUs, ratio ${ratio.toFixed(2)}); short cells may ` +
        `drift 20–60% from a quiet baseline. ` +
        `Set TTSC_BENCH_SKIP_LOAD_CHECK=1 to ignore.`;
      if (process.env.TTSC_BENCH_REQUIRE_QUIET === "1") {
        throw new Error(`bench: ${msg}`);
      }
      process.stderr.write(`[bench] warning: ${msg}\n`);
    }
  }

  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  if (!flags.has("--no-setup")) {
    packTarballs();
    const setupFailures = [];
    for (const project of wantedProjects) {
      for (const branch of projectBranches(project)) {
        try {
          setupClone(project, branch);
        } catch (error) {
          setupFailures.push(
            `${project.repoName}@${branch}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    }
    if (setupFailures.length && !flags.has("--allow-missing")) {
      throw new Error(
        "setup failed; pass --allow-missing to measure the ready subset\n" +
          setupFailures.map((f) => `- ${f}`).join("\n"),
      );
    }
  }

  if (flags.has("--setup-only")) {
    process.stdout.write(`Setup complete in ${WORK}\n`);
    return;
  }

  const readyProjects = wantedProjects.filter((project) =>
    projectBranches(project).every((branch) =>
      fs.existsSync(cloneDir(project, branch)),
    ),
  );
  const missingProjects = wantedProjects.filter(
    (project) => !readyProjects.includes(project),
  );
  if (missingProjects.length && !flags.has("--allow-missing")) {
    throw new Error(
      "missing prepared clones; run without --no-setup to clone/install them " +
        "or pass --allow-missing\n" +
        missingProjects.map((project) => `- ${project.repoName}`).join("\n"),
    );
  }

  if (flags.has("--verify-only")) {
    verifyCommands(readyProjects);
    return;
  }

  const report = createReport(readyProjects);
  writeReports(report);
  for (const project of readyProjects) measureProject(project, report);
  writeReports(report, { publishWebsite: true });

  process.stdout.write(`Report written to ${OUT}\n`);
  process.stdout.write(`Website JSON written to ${WEBSITE_JSON}\n`);
  process.stdout.write(
    `[timer] total benchmark ${formatDuration(hrtimeMs(totalStart))}\n`,
  );
}

function verifyCommands(projects) {
  const failures = [];
  for (const project of projects) {
    for (const cell of projectCells(project)) {
      const root = cloneDir(project, cell.branch);
      process.stdout.write(`\nVERIFY ${cell.id}\n`);
      const result = runSteps(cell.steps, root);
      if (!result.ok) {
        failures.push(`${cell.id} failed (${result.status})`);
        process.stderr.write(result.log);
      } else {
        process.stdout.write(`  ok ${result.ms.toFixed(0)} ms\n`);
      }
    }
  }
  if (failures.length) {
    throw new Error(
      `benchmark command verification failed\n${failures
        .map((f) => `- ${f}`)
        .join("\n")}`,
    );
  }
  process.stdout.write("\nAll benchmark commands verified.\n");
}

function projectCells(project) {
  const cells = [];
  for (const branch of BRANCHES) {
    const branchCommands = project.commands[branch];
    if (!branchCommands) continue;
    for (const op of ["build", "noEmit", "eslint", "format"]) {
      const baseSteps = branchCommands[op];
      if (!baseSteps?.length) continue;
      const measuredSteps =
        branch === "ttsc-lint" && isLintOp(op)
          ? diagnosticsSteps(baseSteps)
          : baseSteps;
      if (branch === "legacy" || op === "eslint") {
        // Legacy compilers and the ESLint pass do not vary by ttsc's
        // threading axis. Keep the cell at `threading: "multi"` (its
        // natural default — uncapped CPU use) so the dashboard's legacy
        // baseline lookups (`branch: "legacy", threading: "multi"`) keep
        // resolving without a separate schema-cutover step.
        cells.push({
          id: `${project.name}:${branch}:${op}:multi`,
          project,
          branch,
          op,
          threading: "multi",
          steps: measuredSteps,
        });
      } else {
        const variants =
          op === "format" ? formatThreadingVariants() : threadingVariants();
        for (const variant of variants) {
          cells.push({
            id: `${project.name}:${branch}:${op}:${variant.name}`,
            project,
            branch,
            op,
            threading: variant.name,
            steps: variant.apply(measuredSteps),
          });
        }
      }
    }
  }
  return filterCells(cells);
}

function projectBranches(project) {
  return [...new Set(projectCells(project).map((cell) => cell.branch))];
}

function filterCells(cells) {
  const predicates = [];
  if (flags.has("--ttsc-build-only") || flags.has("--only-ttsc-build")) {
    predicates.push((cell) => cell.branch === "ttsc" && cell.op === "build");
  }
  if (flags.has("--lint-only")) {
    predicates.push(isLintComparisonCell);
  }
  if (flags.has("--format-only")) {
    predicates.push(isFormatComparisonCell);
  }
  for (const filter of cellFilters) {
    predicates.push((cell) => filter.test(cell.id));
  }
  if (predicates.length === 0) return cells;
  return cells.filter((cell) =>
    predicates.some((predicate) => predicate(cell)),
  );
}

function isLintComparisonCell(cell) {
  if (cell.branch === "legacy")
    return cell.op === "noEmit" || cell.op === "eslint";
  if (cell.branch === "ttsc") return cell.op === "noEmit";
  return cell.branch === "ttsc-lint" && cell.op === "noEmit";
}

function isFormatComparisonCell(cell) {
  return cell.op === "format";
}
