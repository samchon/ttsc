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

const RUNS = numberEnv("TTSC_BENCH_RUNS", 10);
const WARMUP = numberEnv("TTSC_BENCH_WARMUP", 1, { allowZero: true });
const RETRIES = numberEnv("TTSC_BENCH_RETRIES", 2);
const BRANCHES = ["legacy", "ttsc", "ttsc-lint"];
const TTSC_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "packages/ttsc/package.json"), "utf8"),
).version;
const PLATFORM_KEY = `${process.platform}-${process.arch}`;
const PLATFORM_PACKAGE = `@ttsc/${PLATFORM_KEY}`;
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
      eslint: ["pnpm exec eslint . --ignore-pattern 'temp/**'"],
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
          cmd: "yarn --ignore-engines exec eslint -- 'src/**/*.ts' --ignore-pattern '**/*.d.ts'",
        },
        {
          cwd: "packages/rxjs",
          cmd: "yarn --ignore-engines exec eslint -- 'src/**/*.ts' --ignore-pattern '**/*.d.ts'",
        },
      ],
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
      eslint: ["pnpm exec eslint . --quiet"],
    }),
  },
  typeorm: {
    kind: "ORM library",
    repoName: "ttsc-benchmark-typeorm",
    repo: "https://github.com/samchon/ttsc-benchmark-typeorm.git",
    packageManager: "pnpm",
    installCommand:
      "pnpm --ignore-workspace install --virtual-store-dir node_modules/.pnpm --no-frozen-lockfile --ignore-scripts",
    installTarballsCommand: (specs) =>
      `pnpm --ignore-workspace add --virtual-store-dir node_modules/.pnpm -D --ignore-scripts ${specs}`,
    prepareCommand: "pnpm exec ttsc prepare -p tsconfig.json",
    filesRoot: "src",
    commands: compilerCommands({
      build: (tool) => [`pnpm exec ${tool} -p tsconfig.json`],
      noEmit: (tool) => [`pnpm exec ${tool} -p tsconfig.json --noEmit`],
      eslint: ["pnpm exec eslint --quiet"],
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
      eslint: ["pnpm exec eslint ."],
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
      eslint: ["./node_modules/.bin/eslint src --quiet"],
    }),
  },
  "shopping-backend": {
    kind: "plugin-heavy service",
    repoName: "shopping-backend",
    repo: "https://github.com/samchon/shopping-backend.git",
    packageManager: "pnpm",
    filesRoot: "src",
    commands: {
      legacy: {
        build: normalizeSteps(["pnpm exec tsc -p tsconfig.json"]),
        noEmit: normalizeSteps(["pnpm exec tsc -p tsconfig.json --noEmit"]),
        eslint: normalizeSteps(["pnpm exec eslint src test"]),
      },
      ttsc: {
        build: normalizeSteps(["pnpm exec ttsc -p tsconfig.json"]),
        noEmit: normalizeSteps(["pnpm exec ttsc -p tsconfig.json --noEmit"]),
      },
      "ttsc-lint": {
        build: normalizeSteps(["pnpm exec ttsc -p tsconfig.json"]),
        noEmit: normalizeSteps(["pnpm exec ttsc -p tsconfig.json --noEmit"]),
      },
    },
  },
};

const PROJECTS = Object.entries(PACKAGE_CONFIGS)
  .filter(([, config]) => !config.disabled)
  .map(([name, config]) => ({
    name,
    ...config,
  }));

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

function compilerCommands({ build, noEmit, eslint }) {
  const ttsc = {
    build: normalizeSteps(build("ttsc")),
    noEmit: normalizeSteps(noEmit("ttsc")),
  };
  return {
    legacy: {
      build: normalizeSteps(build("tsc")),
      noEmit: normalizeSteps(noEmit("tsc")),
      eslint: normalizeSteps(eslint),
    },
    ttsc,
    "ttsc-lint": {
      build: normalizeSteps(build("ttsc")),
      noEmit: normalizeSteps(noEmit("ttsc")),
    },
  };
}

function rxjsNoEmitSteps(tool) {
  return [
    "./src/tsconfig.cjs.json",
    "./src/tsconfig.esm.json",
    "./src/tsconfig.types.json",
  ].map((config) => ({
    cwd: "packages/rxjs",
    cmd: `yarn --ignore-engines exec ${tool} -- -p ${config} --noEmit`,
  }));
}

function rxjsBuildSteps(tool) {
  return [
    "./src/tsconfig.cjs.json",
    "./src/tsconfig.esm.json",
    "./src/tsconfig.types.json",
  ].map((config) => ({
    cwd: "packages/rxjs",
    cmd: `yarn --ignore-engines exec ${tool} -- -p ${config}`,
  }));
}

function nestjsCommands() {
  return {
    legacy: {
      build: normalizeSteps(nestjsPackageSteps("tsc", false)),
      noEmit: normalizeSteps(nestjsPackageSteps("tsc", true)),
      eslint: normalizeSteps([
        "npm exec -- eslint 'packages/**/**.ts' --ignore-pattern 'packages/**/*.spec.ts'",
      ]),
    },
    ttsc: {
      build: normalizeSteps(nestjsPackageSteps("ttsc", false)),
      noEmit: normalizeSteps(nestjsPackageSteps("ttsc", true)),
    },
    "ttsc-lint": {
      build: normalizeSteps(nestjsPackageSteps("ttsc", false)),
      noEmit: normalizeSteps(nestjsPackageSteps("ttsc", true)),
    },
  };
}

function nestjsPackageSteps(tool, noEmit) {
  const packages = [
    "common",
    "core",
    "microservices",
    "platform-express",
    "platform-fastify",
    "platform-socket.io",
    "platform-ws",
    "testing",
    "websockets",
  ];
  return packages.map((pkg) => ({
    cmd:
      `npm exec -- ${tool} -p packages/${pkg}/tsconfig.build.json` +
      (noEmit ? " --noEmit" : ""),
  }));
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
  process.stdout.write(`[timer] start ${label}\n`);
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
  if (options.timing !== false) process.stdout.write(`[cmd] start ${label}\n`);
  const res = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: options.env ?? process.env,
    stdio: options.quiet ? "pipe" : "inherit",
  });
  if (options.timing !== false)
    process.stdout.write(
      `[cmd] done ${label} in ${formatDuration(hrtimeMs(start))} ` +
        `(exit ${res.status})\n`,
    );
  if (options.check !== false && res.status !== 0) {
    throw new Error(
      `command failed (${res.status}) in ${cwd}: ${cmd}\n${res.stderr ?? ""}`,
    );
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
    process.stdout.write(
      `    [step] start ${path.relative(root, cwd) || "."}: ${cmd}\n`,
    );
    const res = spawnSync(cmd, {
      cwd,
      shell: true,
      encoding: "utf8",
      env: step.env ? { ...process.env, ...step.env } : process.env,
    });
    process.stdout.write(
      `    [step] done ${path.relative(root, cwd) || "."}: ` +
        `${formatDuration(hrtimeMs(stepStart))} (exit ${res.status})\n`,
    );
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
        ? pnpmProjectCommand(dir, "install --no-frozen-lockfile")
        : pm === "yarn"
          ? "YARN_CACHE_FOLDER=.yarn-cache yarn install --ignore-engines --update-checksums"
          : "npm install --legacy-peer-deps");
    if (!hasNodeModules || flags.has("--force-install")) {
      process.stdout.write(`Installing ${path.basename(dir)} with ${pm}\n`);
      sh(cmd, dir, { label: `install dependencies ${path.basename(dir)}` });
    } else {
      process.stdout.write(
        `Reusing installed node_modules in ${path.basename(dir)}\n`,
      );
    }
    if (mustRefreshTarballs) installLocalTarballs(project, dir, branch);
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
    const cmd =
      project.installTarballsCommand?.(specs) ??
      (pm === "pnpm"
        ? ownsPnpmWorkspace(dir)
          ? `pnpm add -w -D ${specs}`
          : `pnpm add --ignore-workspace -D ${specs}`
        : pm === "yarn"
          ? `YARN_CACHE_FOLDER=.yarn-cache yarn add --dev --force --update-checksums --ignore-engines --ignore-workspace-root-check ${specs}`
          : `npm install --legacy-peer-deps --save-dev ${specs}`);
    process.stdout.write(
      `Installing local tarballs into ${path.basename(dir)}: ` +
        `${targets.map((target) => target.name).join(", ")}\n`,
    );
    sh(cmd, dir, { label: `install local tarballs ${path.basename(dir)}` });
  });
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
  for (const target of targets) {
    const pattern = new RegExp(
      `(?:file:)?[^\\s'",}]*ttsc-tgz[^\\s'",}]*/${escapeRegExp(target.file)}`,
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

function measureCell({ id, project, branch, tool, op, threading, steps }) {
  const root = cloneDir(project, branch);
  process.stdout.write(`\n[${id}] ${RUNS} runs\n`);

  const run = () => runSteps(steps, root);

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

  return {
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
  let typescript = "unknown";
  for (const project of projects) {
    typescript =
      depVersion(cloneDir(project, "legacy"), "typescript") ?? typescript;
  }
  return {
    os: osName,
    kernel: os.release(),
    cpu: cpus[0]?.model?.trim() ?? "unknown",
    cores: cpus.length,
    ramGB: Math.round(os.totalmem() / 2 ** 30),
    node: process.version,
    ttsc: TTSC_VERSION,
    typescript,
  };
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
    lines.push("| Branch | Op | Threading | Median | Samples | Failure |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const m of project.measurements) {
      lines.push(
        `| ${m.branch} | ${m.op} | ${m.threading} | ${formatMs(m.medianMs)} | ` +
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
      merged.projects.push(oldProject);
    }
  }
  return merged;
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
    for (const op of ["build", "noEmit", "eslint"]) {
      const baseSteps = branchCommands[op];
      if (!baseSteps?.length) continue;
      if (branch === "legacy" || op === "eslint") {
        cells.push({
          id: `${project.name}:${branch}:${op}:multi`,
          project,
          branch,
          op,
          threading: "multi",
          steps: baseSteps,
        });
      } else {
        cells.push({
          id: `${project.name}:${branch}:${op}:multi`,
          project,
          branch,
          op,
          threading: "multi",
          steps: baseSteps,
        });
        cells.push({
          id: `${project.name}:${branch}:${op}:single`,
          project,
          branch,
          op,
          threading: "single",
          steps: singleThreadedSteps(baseSteps),
        });
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
  for (const filter of cellFilters) {
    predicates.push((cell) => filter.test(cell.id));
  }
  if (predicates.length === 0) return cells;
  return cells.filter((cell) =>
    predicates.some((predicate) => predicate(cell)),
  );
}

function isLintComparisonCell(cell) {
  if (cell.branch === "legacy") return cell.op === "eslint";
  if (cell.branch === "ttsc") return cell.op === "noEmit";
  return cell.branch === "ttsc-lint" && cell.op === "noEmit";
}
