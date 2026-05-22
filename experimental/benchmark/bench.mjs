#!/usr/bin/env node
/**
 * ttsc matrix benchmark runner.
 *
 * Clone-based, fully reproducible from a clean checkout. For every fixture
 * project the runner clones three branches of a forked repo —
 *
 *   - `legacy`    stock `tsc` toolchain (TypeScript 5.x · prettier · eslint)
 *   - `ttsc`      the `ttsc` toolchain (TypeScript 7 via @typescript/native-preview)
 *   - `ttsc-lint` `ttsc` + `@ttsc/lint` (lint folded into the compile pass)
 *
 * — then measures, for each (project × branch):
 *
 *   - emit build           the project's real build command (type-check + emit)
 *   - noEmit               the same input under `--noEmit` (type-check only)
 *   - multi-threaded       ttsc's default (parallel parse/check/emit)
 *   - single-threaded      `--singleThreaded` (TypeScript-Go fully serial)
 *
 * The legacy branch is only measured multi-threaded (stock `tsc` has no
 * `--singleThreaded`); the ttsc / ttsc-lint branches are measured both ways.
 *
 * Each cell does WARMUP unmeasured runs then RUNS measured runs and reports the
 * median. A measured run that exits non-zero is classified as a `race` failure
 * (the intermittent Go data-race crash — retried, the clean timing is kept) or
 * a deterministic `error` (a real compile error — not retried, cell left
 * unmeasured). A (project × branch) whose fork branch does not exist yet, or a
 * mode a project does not support, is skipped cleanly — never a crash.
 *
 * Pipeline:
 *
 *   1. build + pack the local ttsc / @ttsc/lint / current-platform tarballs
 *      into /tmp/ttsc-tgz/ so fixtures install the compiler under test;
 *   2. `git clone` each fixture branch into an OUTSIDE-the-repo working dir
 *      (cloning inside the ttsc tree would let pnpm adopt the clone into the
 *      ttsc workspace) — default /tmp/ttsc-bench-work/;
 *   3. `pnpm install` each clone; `ttsc prepare` the ttsc / ttsc-lint clones;
 *      run each project's prerequisites (e.g. shopping-backend build:prisma);
 *   4. measure the matrix; write a Markdown report + JSON sidecar into the
 *      git-ignored `.work/` directory.
 *
 * Usage:
 *   node bench.mjs [projects...]            # e.g. `node bench.mjs tstl zod`
 *   node bench.mjs --setup-only             # clone + install, no measuring
 *   node bench.mjs --no-setup               # measure only (reuse clones)
 *   node bench.mjs --list                   # print the config table and exit
 *
 * Environment overrides:
 *   TTSC_BENCH_WORK=/path        clone working dir       (default /tmp/ttsc-bench-work)
 *   TTSC_BENCH_TGZ=/path         tarball staging dir     (default /tmp/ttsc-tgz)
 *   TTSC_BENCH_OUT=/path/x.md    report destination      (default .work/report.md)
 *   TTSC_BENCH_RUNS=3            measured runs per cell
 *   TTSC_BENCH_WARMUP=1          warmup runs per cell
 *   TTSC_BENCH_RETRIES=3         retries to recover a crashed run
 *   TTSC_BENCH_SKIP_PACK=1       reuse existing tarballs (skip step 1)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ── configuration ────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const WORK =
  process.env.TTSC_BENCH_WORK ?? path.join(os.tmpdir(), "ttsc-bench-work");
const TGZ = process.env.TTSC_BENCH_TGZ ?? path.join(os.tmpdir(), "ttsc-tgz");
const OUT =
  process.env.TTSC_BENCH_OUT ??
  path.resolve(import.meta.dirname, ".work", "report.md");
const RUNS = Number(process.env.TTSC_BENCH_RUNS ?? 3);
const WARMUP = Number(process.env.TTSC_BENCH_WARMUP ?? 1);
const RETRIES = Number(process.env.TTSC_BENCH_RETRIES ?? 3);

// The ttsc workspace version every fixture branch pins its tarballs against.
const TTSC_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "packages/ttsc/package.json"), "utf8"),
).version;
const PLATFORM_KEY = `${process.platform}-${process.arch}`;

/**
 * The declarative per-project matrix.
 *
 * Each project clones a forked repo and exposes one or more `cases`. A case is
 * a measured command parametrised over a branch and a mode. `build` is the
 * emit-producing command; `noEmit` is the type-check-only command; both omit
 * the project's clean step so the timing is the compiler, not `rimraf`. The
 * runner prepends the clean step itself when a case declares `clean`.
 *
 * `singleThreaded: true` on a case means the runner *also* measures it with
 * `--singleThreaded` appended (only meaningful for ttsc / ttsc-lint branches).
 *
 * A branch absent from `branches` is a fork branch not pushed yet — the runner
 * skips it. TODO entries below are projects/branches still being set up.
 */
const PROJECTS = {
  // ── plugin-heavy: every file runs typia + @nestia source-plugin transforms ──
  "shopping-backend": {
    repo: "https://github.com/samchon/shopping-backend.git",
    kind: "plugin-heavy",
    branches: ["legacy", "ttsc", "ttsc-lint"],
    // Prisma client + nestia SDK that build:main type-checks against.
    prerequisites: ["build:prisma", "build:sdk"],
    cases: [
      {
        // build:test is intentionally not measured: shopping-backend's matrix
        // is build:main only (the test tsconfig double-counts the same files).
        name: "build:main",
        emit: true,
        singleThreaded: true,
        legacy: { build: "pnpm exec tsc" },
        ttsc: {
          build: "pnpm exec ttsc",
          noEmit: "pnpm exec ttsc --noEmit",
          stClean: "pnpm exec rimraf lib",
        },
      },
    ],
  },

  // ── plugin-free emit-producing libraries (the scaling curve) ────────────────
  tstl: {
    repo: "https://github.com/samchon/tstl.git",
    kind: "plugin-free",
    branches: ["legacy", "ttsc", "ttsc-lint"],
    prerequisites: [],
    cases: [
      {
        name: "build",
        emit: true,
        singleThreaded: true,
        legacy: { build: "pnpm exec tsc" },
        ttsc: {
          build: "pnpm exec ttsc",
          noEmit: "pnpm exec ttsc --noEmit",
          stClean: "pnpm exec rimraf lib",
        },
      },
    ],
  },

  zod: {
    repo: "https://github.com/samchon/ttsc-benchmark-zod.git",
    kind: "plugin-free",
    branches: ["legacy", "ttsc", "ttsc-lint"],
    prerequisites: [],
    cases: [
      {
        // `build:benchmark` compiles the zod package via tsconfig.benchmark.json
        // (tsc on legacy, ttsc on ttsc/ttsc-lint).
        name: "build:benchmark",
        emit: true,
        singleThreaded: true,
        cwd: "packages/zod",
        legacy: { build: "pnpm exec tsc -p tsconfig.benchmark.json" },
        ttsc: {
          build: "pnpm exec ttsc -p tsconfig.benchmark.json",
          noEmit: "pnpm exec ttsc -p tsconfig.benchmark.json --noEmit",
          stClean: "pnpm exec rimraf lib",
        },
      },
    ],
  },

  rxjs: {
    repo: "https://github.com/samchon/ttsc-benchmark-rxjs.git",
    kind: "plugin-free",
    branches: ["legacy", "ttsc", "ttsc-lint"],
    // rxjs is a yarn/nx monorepo; the benchmark cell is the rxjs package only.
    packageManager: "yarn",
    prerequisites: [],
    cases: [
      {
        // `build:bench` compiles packages/rxjs via tsconfig.bench.json.
        name: "build:bench",
        emit: true,
        singleThreaded: true,
        cwd: "packages/rxjs",
        legacy: { build: "yarn exec tsc -- -p tsconfig.bench.json" },
        ttsc: {
          build: "yarn exec ttsc -- -p tsconfig.bench.json",
          noEmit: "yarn exec ttsc -- -p tsconfig.bench.json --noEmit",
          stClean: "pnpm exec rimraf dist-bench",
        },
      },
    ],
  },

  // ── plugin-free pure type-check (no emit build) ─────────────────────────────
  "type-fest": {
    repo: "https://github.com/samchon/ttsc-benchmark-type-fest.git",
    kind: "plugin-free",
    branches: ["legacy", "ttsc", "ttsc-lint"],
    prerequisites: [],
    cases: [
      {
        // type-fest's tsconfig is permanently `noEmit: true` — a pure
        // type-checker stress with no emit cell. `emit: false` keeps it out of
        // the emit-build comparison so it is not weighed against emitting cells.
        name: "check",
        emit: false,
        singleThreaded: true,
        legacy: { build: "pnpm exec tsc" },
        ttsc: {
          build: "pnpm exec ttsc",
          // build is already noEmit; no separate noEmit cell.
        },
      },
    ],
  },

  // ── frontend framework: type-check only (vue builds via rollup) ─────────────
  vue: {
    repo: "https://github.com/samchon/ttsc-benchmark-vue.git",
    kind: "plugin-free",
    // TODO: ttsc-lint branch not pushed yet — see issue #118 fixture work.
    branches: ["legacy", "ttsc"],
    prerequisites: [],
    cases: [
      {
        name: "check",
        emit: false,
        singleThreaded: true,
        legacy: { build: "pnpm exec tsc --incremental --noEmit" },
        ttsc: { build: "pnpm exec ttsc --noEmit" },
      },
    ],
  },

  // ── backend framework: project-references monorepo via a build orchestrator ─
  nestjs: {
    repo: "https://github.com/samchon/ttsc-benchmark-nestjs.git",
    kind: "plugin-free",
    branches: ["legacy", "ttsc", "ttsc-lint"],
    prerequisites: [],
    cases: [
      {
        // nestjs has no `tsc -b` analogue in ttsc; the ttsc branches ship a
        // `scripts/build-ttsc.mjs` orchestrator that walks packages in
        // topological order. That orchestrator emits and exposes no --noEmit /
        // --singleThreaded flag, so this case measures the emit build only.
        name: "build",
        emit: true,
        singleThreaded: false,
        legacy: { build: "pnpm exec tsc -b packages" },
        ttsc: { build: "node scripts/build-ttsc.mjs" },
      },
    ],
  },

  // TODO(#118): vscode fixture — the samchon/ttsc-benchmark-vscode repo has no
  // legacy / ttsc / ttsc-lint branches yet. When the fixture agent pushes them,
  // add a `vscode` entry here mirroring `vue` (VSCode type-checks via `tsc`).
};

// ── argument parsing ─────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const positional = argv.filter((a) => !a.startsWith("--"));
const wantedProjects = positional.length
  ? positional.filter((p) => PROJECTS[p])
  : Object.keys(PROJECTS);

if (flags.has("--list")) {
  printConfigTable();
  process.exit(0);
}
if (positional.length && wantedProjects.length === 0) {
  process.stderr.write(
    `No known project in [${positional.join(", ")}].\n` +
      `Known: ${Object.keys(PROJECTS).join(", ")}\n`,
  );
  process.exit(1);
}

// ── shell helpers ────────────────────────────────────────────────────────────

function sh(cmd, cwd, { check = true, quiet = false, env } = {}) {
  const res = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: env ?? process.env,
    stdio: quiet ? "pipe" : "inherit",
  });
  if (check && res.status !== 0) {
    throw new Error(
      `command failed (exit ${res.status}): ${cmd}\n${res.stderr ?? ""}`,
    );
  }
  return res;
}

/** Time a command once; never throws — a failed run is reported, not fatal. */
function runOnce(cmd, cwd, env) {
  const t0 = process.hrtime.bigint();
  const res = spawnSync(cmd, {
    cwd,
    shell: true,
    encoding: "utf8",
    env: env ?? process.env,
  });
  const t1 = process.hrtime.bigint();
  return {
    ms: Number(t1 - t0) / 1e6,
    ok: res.status === 0,
    status: res.status,
    log: `${res.stdout ?? ""}${res.stderr ?? ""}`,
  };
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Classify a failed run from its output. A `race` failure is the intermittent
 * Go data-race crash; anything else is a deterministic `error` (e.g. a type
 * error). This keeps an orthogonal stability bug from being mislabelled — and
 * stops a deterministic compile error from being reported as a "crash".
 */
function classifyFailure(log) {
  return /concurrent map|fatal error|\bpanic:|DATA RACE/.test(log)
    ? "race"
    : "error";
}

// ── step 1: build + pack the local ttsc tarballs ─────────────────────────────

/**
 * Build the workspace and pack ttsc / @ttsc/lint / the current-platform package
 * into TGZ under the exact filenames the fixture branches pin
 * (`ttsc-<version>.tgz`, `ttsc-lint-<version>.tgz`,
 * `ttsc-<platform>-<version>.tgz`). Fixtures reference these via
 * `file:/tmp/ttsc-tgz/...` so an install picks up the compiler under test.
 */
function packTarballs() {
  if (process.env.TTSC_BENCH_SKIP_PACK === "1" || flags.has("--no-pack")) {
    process.stdout.write(`◦ skipping tarball pack (reusing ${TGZ})\n`);
    return;
  }
  process.stdout.write(`\n▸ building + packing ttsc tarballs into ${TGZ}\n`);
  fs.mkdirSync(TGZ, { recursive: true });
  sh("pnpm run build:current", REPO_ROOT);
  const targets = [
    { dir: "packages/ttsc", file: `ttsc-${TTSC_VERSION}.tgz` },
    { dir: "packages/lint", file: `ttsc-lint-${TTSC_VERSION}.tgz` },
    {
      dir: `packages/ttsc-${PLATFORM_KEY}`,
      file: `ttsc-${PLATFORM_KEY}-${TTSC_VERSION}.tgz`,
    },
  ];
  for (const t of targets) {
    const dir = path.join(REPO_ROOT, t.dir);
    if (!fs.existsSync(dir)) {
      throw new Error(`tarball source missing: ${t.dir}`);
    }
    const out = path.join(TGZ, t.file);
    fs.rmSync(out, { force: true });
    sh(`pnpm pack --out ${JSON.stringify(out)}`, dir);
    process.stdout.write(`  packed ${t.file}\n`);
  }
}

// ── step 2 + 3: clone + install a fixture branch ─────────────────────────────

/** Working directory for one (project, branch) clone. */
function cloneDir(project, branch) {
  return path.join(WORK, `${project}@${branch}`);
}

/**
 * Clone `branch` of `project`'s repo into the working directory and install it.
 * Returns `false` (skip, not fatal) when the branch does not exist on the fork
 * — fixture branches are still being pushed. A stray `pnpm-workspace.yaml` is
 * dropped into the clone so pnpm treats it as an isolated workspace even if it
 * ever lands inside another workspace tree.
 */
function setupClone(project, branch) {
  const cfg = PROJECTS[project];
  const dir = cloneDir(project, branch);
  const pm = cfg.packageManager ?? "pnpm";

  // Branch existence probe — a missing fork branch is skipped, not a crash.
  const probe = spawnSync(
    "git",
    ["ls-remote", "--exit-code", "--heads", cfg.repo, branch],
    { encoding: "utf8" },
  );
  if (probe.status !== 0) {
    process.stdout.write(
      `  ⚠ ${project}@${branch}: branch not on fork yet — skipped\n`,
    );
    return false;
  }

  fs.rmSync(dir, { recursive: true, force: true });
  process.stdout.write(`  cloning ${project}@${branch}\n`);
  sh(
    `git clone --depth 1 --branch ${branch} ${cfg.repo} ${JSON.stringify(dir)}`,
    WORK,
    { quiet: true },
  );
  // Isolate the clone from any surrounding pnpm workspace.
  if (!fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    fs.writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages: []\n");
  }

  process.stdout.write(`  installing ${project}@${branch} (${pm})\n`);
  const installCmd =
    pm === "yarn"
      ? "yarn install --frozen-lockfile || yarn install"
      : "pnpm install --no-frozen-lockfile";
  sh(installCmd, dir, { quiet: true });

  // `ttsc prepare` builds the cached plugin binaries the ttsc branches need.
  if (branch === "ttsc" || branch === "ttsc-lint") {
    const prep = spawnSync(`${pm} exec ttsc prepare`, {
      cwd: dir,
      shell: true,
      encoding: "utf8",
    });
    if (prep.status !== 0) {
      process.stdout.write(
        `  ◦ ${project}@${branch}: 'ttsc prepare' exited ${prep.status} ` +
          `(ok if the project defines no plugins)\n`,
      );
    }
  }

  // Project-specific prerequisites (e.g. Prisma client, nestia SDK).
  for (const script of cfg.prerequisites ?? []) {
    process.stdout.write(`  prerequisite: ${project}@${branch} ${script}\n`);
    sh(`${pm} run ${script}`, dir, { quiet: true });
  }
  return true;
}

// ── step 4: measure one cell ─────────────────────────────────────────────────

/**
 * Measure one matrix cell: WARMUP unmeasured runs, then RUNS measured runs.
 * `prep` (e.g. a clean step) runs unmeasured before every run so each timing
 * starts from the same state. Returns the per-cell result record.
 */
function measureCell(label, cmd, cwd, { prep, crashy } = {}) {
  process.stdout.write(`\n▶ ${label}\n  ${cmd}${prep ? `\n  prep: ${prep}` : ""}\n`);
  const fresh = () => {
    if (prep) spawnSync(prep, { cwd, shell: true });
    return runOnce(cmd, cwd);
  };
  for (let i = 0; i < WARMUP; i++) {
    const w = fresh();
    process.stdout.write(
      `  warmup ${i + 1}: ${w.ms.toFixed(0)} ms ${w.ok ? "ok" : `EXIT ${w.status}`}\n`,
    );
  }
  const samples = [];
  let raceRetries = 0;
  let deterministicFailure = null;
  for (let i = 0; i < RUNS; i++) {
    let r = fresh();
    let attempts = 0;
    while (!r.ok && attempts < RETRIES) {
      const kind = classifyFailure(r.log);
      if (kind === "race") raceRetries++;
      attempts++;
      process.stdout.write(
        `  run ${i + 1}: EXIT ${r.status} (${kind}) — retry ${attempts}\n`,
      );
      if (kind === "error") break; // deterministic: retrying will not help
      r = fresh();
    }
    if (!r.ok) {
      deterministicFailure = { status: r.status, kind: classifyFailure(r.log) };
      process.stdout.write(
        `  run ${i + 1}: EXIT ${r.status} — deterministic failure, not measured\n`,
      );
      continue;
    }
    samples.push(r.ms);
    process.stdout.write(`  run ${i + 1}: ${r.ms.toFixed(0)} ms\n`);
  }
  return {
    label,
    samples,
    raceRetries,
    deterministicFailure,
    median: samples.length ? median(samples) : null,
    min: samples.length ? Math.min(...samples) : null,
  };
}

/**
 * Expand a (project, branch, case) into measured cells and record them into
 * `results`. The `ttsc` / `ttsc-lint` branches add a noEmit cell and (when the
 * case opts in) single-threaded variants of build + noEmit.
 */
function measureCase(results, project, branch, c) {
  const cfg = PROJECTS[project];
  const dir = cloneDir(project, branch);
  if (!fs.existsSync(dir)) return; // setup skipped this branch
  const runCwd = c.cwd ? path.join(dir, c.cwd) : dir;
  const spec = branch === "legacy" ? c.legacy : c.ttsc;
  if (!spec) return;
  const key = (mode) => `${project}|${branch}|${c.name}|${mode}`;

  // emit / type-check build, multi-threaded (ttsc's default; the only mode for legacy).
  if (spec.build) {
    results[key("mt")] = measureCell(key("mt"), spec.build, runCwd);
  }
  // type-check-only build.
  if (spec.noEmit) {
    results[key("noEmit")] = measureCell(key("noEmit"), spec.noEmit, runCwd);
  }
  // single-threaded variants — ttsc / ttsc-lint only, and only when opted in.
  if (c.singleThreaded && branch !== "legacy") {
    const prep = spec.stClean
      ? `${spec.stClean.replace("pnpm exec", (cfg.packageManager ?? "pnpm") + " exec")}`
      : undefined;
    if (spec.build) {
      results[key("st")] = measureCell(
        key("st"),
        `${spec.build} --singleThreaded`,
        runCwd,
        { prep },
      );
    }
    if (spec.noEmit) {
      results[key("st-noEmit")] = measureCell(
        key("st-noEmit"),
        `${spec.noEmit} --singleThreaded`,
        runCwd,
      );
    }
  }
}

// ── host spec ────────────────────────────────────────────────────────────────

/**
 * Read a dependency's installed version from a package's node_modules. Returns
 * `undefined` when the package is not present so callers can fall back.
 */
function depVersion(fromDir, pkg) {
  try {
    const p = path.join(fromDir, "node_modules", pkg, "package.json");
    return JSON.parse(fs.readFileSync(p, "utf8")).version;
  } catch {
    return undefined;
  }
}

/**
 * Collect the host machine spec + toolchain versions for the report header.
 * `tsgo`/`tsc` resolve from the fixture clones (that is where the compilers are
 * installed); `tsgo` reads `@typescript/native-preview` from a `ttsc` clone and
 * `tsc` reads `typescript` from a `legacy` clone.
 */
function hostSpec(wantedProjectsList) {
  const cpu = os.cpus();
  let osName = `${os.type()} ${os.release()}`;
  try {
    const rel = fs.readFileSync("/etc/os-release", "utf8");
    const pretty = rel.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
    if (pretty) osName = `${pretty[1]} (kernel ${os.release()})`;
  } catch {
    /* not Linux — keep os.type()/os.release() */
  }
  // Walk fixture clones for the first one that has each compiler installed.
  let tsgo, tsc;
  for (const project of wantedProjectsList) {
    tsgo ??= depVersion(
      cloneDir(project, "ttsc"),
      "@typescript/native-preview",
    );
    tsc ??= depVersion(cloneDir(project, "legacy"), "typescript");
  }
  return {
    os: osName,
    cpu: `${cpu.length}× ${cpu[0]?.model?.trim() ?? "unknown"}`,
    ram: `${(os.totalmem() / 2 ** 30).toFixed(0)} GB`,
    node: process.version,
    ttsc: TTSC_VERSION,
    tsgo: tsgo ?? "—",
    tsc: tsc ?? "—",
  };
}

// ── reporting ────────────────────────────────────────────────────────────────

function s(ms) {
  return ms == null ? "—" : `${(ms / 1000).toFixed(2)} s`;
}
function ratio(slow, fast) {
  return slow == null || fast == null || fast === 0
    ? "—"
    : `${(slow / fast).toFixed(2)}×`;
}

function buildReport(results, started, host) {
  const R = (k) => results[k] ?? null;
  const med = (k) => R(k)?.median ?? null;
  const L = [];
  L.push(`# ttsc matrix benchmark`);
  L.push("");
  L.push(`- Date: ${started.toISOString()}`);
  L.push("");
  L.push(`## Host`);
  L.push("");
  L.push(`| Field | Value |`);
  L.push(`| --- | --- |`);
  L.push(`| OS | ${host.os} |`);
  L.push(`| CPU | ${host.cpu} |`);
  L.push(`| RAM | ${host.ram} |`);
  L.push(`| node | ${host.node} |`);
  L.push(`| ttsc | ${host.ttsc} |`);
  L.push(`| @typescript/native-preview (tsgo) | ${host.tsgo} |`);
  L.push(`| tsc | ${host.tsc} |`);
  L.push("");
  L.push(
    `- Method: ${WARMUP} warmup + ${RUNS} measured runs per cell; median ` +
      `reported. A run hitting the intermittent parallel-emit race is retried ` +
      `(up to ${RETRIES}×); a deterministic failure is left unmeasured.`,
  );
  L.push("");

  // ── M1 — emit build: legacy vs ttsc vs ttsc-lint ──────────────────────────
  L.push(`## M1 — Emit build: tsc (legacy) vs ttsc vs ttsc + @ttsc/lint`);
  L.push("");
  L.push(
    `Multi-threaded emit build per project. type-fest and vue are ` +
      `type-check-only (no emit build) and appear in M2 instead.`,
  );
  L.push("");
  L.push(
    `| Project | kind | legacy · tsc | ttsc | ttsc-lint | tsc→ttsc | lint cost |`,
  );
  L.push(`| --- | --- | --- | --- | --- | --- | --- |`);
  for (const project of wantedProjects) {
    const cfg = PROJECTS[project];
    for (const c of cfg.cases) {
      if (!c.emit) continue;
      const lg = med(`${project}|legacy|${c.name}|mt`);
      const tt = med(`${project}|ttsc|${c.name}|mt`);
      const tl = med(`${project}|ttsc-lint|${c.name}|mt`);
      L.push(
        `| ${project} · ${c.name} | ${cfg.kind} | ${s(lg)} | ${s(tt)} | ` +
          `${s(tl)} | ${ratio(lg, tt)} | ${ratio(tl, tt)} |`,
      );
    }
  }
  L.push("");
  L.push(
    `*tsc→ttsc* is the legacy-over-ttsc speedup. *lint cost* is ttsc-lint ` +
      `over plain ttsc — the marginal cost of folding \`@ttsc/lint\` into the ` +
      `compile pass (a value near 1× means linting is nearly free).`,
  );
  L.push("");

  // ── M2 — type-check only (--noEmit) ───────────────────────────────────────
  L.push(`## M2 — Type-check only (\`--noEmit\`)`);
  L.push("");
  L.push(
    `Pure type-checking, emit excluded. Isolates checker speed from emit cost.`,
  );
  L.push("");
  L.push(`| Project | kind | legacy · tsc | ttsc | ttsc-lint | tsc→ttsc |`);
  L.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const project of wantedProjects) {
    const cfg = PROJECTS[project];
    for (const c of cfg.cases) {
      // For an emit-producing case the type-check-only cell is the `noEmit`
      // mode (ttsc only — legacy has no noEmit cell wired). For a project
      // whose build *is* `noEmit` (type-fest, vue) the `mt` cell IS the
      // type-check cell, and legacy `tsc` is a like-for-like comparison.
      const noEmitMode = c.emit ? "noEmit" : "mt";
      const legacyShown = c.emit ? null : med(`${project}|legacy|${c.name}|mt`);
      const tt = med(`${project}|ttsc|${c.name}|${noEmitMode}`);
      const tl = med(`${project}|ttsc-lint|${c.name}|${noEmitMode}`);
      if (tt == null && tl == null && legacyShown == null) continue;
      L.push(
        `| ${project} · ${c.name} | ${cfg.kind} | ${s(legacyShown)} | ` +
          `${s(tt)} | ${s(tl)} | ${ratio(legacyShown, tt)} |`,
      );
    }
  }
  L.push("");
  L.push(
    `type-fest and vue are \`noEmit\` projects — their M1/M2 cell is the same ` +
      `command, and legacy \`tsc\` for those is shown here as a like-for-like ` +
      `compare. Emit-producing projects measure ttsc \`--noEmit\` only (stock ` +
      `\`tsc\` has no comparable type-check-only build wired in the fixture).`,
  );
  L.push("");

  // ── M3 — threading: single vs multi ───────────────────────────────────────
  L.push(`## M3 — ttsc threading: single-threaded vs multi-threaded`);
  L.push("");
  L.push(
    `\`ttsc --singleThreaded\` runs TypeScript-Go fully serial; the default ` +
      `keeps parallel parse/check/emit. Speedup is multi-threaded over ` +
      `single-threaded.`,
  );
  L.push("");
  L.push(`| Project · branch · step | single-threaded | multi-threaded | speedup |`);
  L.push(`| --- | --- | --- | --- |`);
  for (const project of wantedProjects) {
    const cfg = PROJECTS[project];
    for (const c of cfg.cases) {
      if (!c.singleThreaded) continue;
      for (const branch of ["ttsc", "ttsc-lint"]) {
        const mt = med(`${project}|${branch}|${c.name}|mt`);
        const st = med(`${project}|${branch}|${c.name}|st`);
        if (mt == null && st == null) continue;
        L.push(
          `| ${project} · ${branch} · ${c.name} | ${s(st)} | ${s(mt)} | ` +
            `${ratio(st, mt)} |`,
        );
      }
    }
  }
  L.push("");

  // ── stability ─────────────────────────────────────────────────────────────
  const raced = Object.values(results).filter((r) => r.raceRetries > 0);
  const failed = Object.values(results).filter((r) => r.deterministicFailure);
  if (raced.length || failed.length) {
    L.push(`## Stability`);
    L.push("");
    if (raced.length) {
      L.push(
        `Parallel-emit data-race retries — intermittent; the reported timing ` +
          `is from a clean run:`,
      );
      L.push("");
      for (const r of raced)
        L.push(
          `- \`${r.label}\`: ${r.raceRetries} race ` +
            `retr${r.raceRetries === 1 ? "y" : "ies"}`,
        );
      L.push("");
    }
    if (failed.length) {
      L.push(
        `Deterministic failures — retrying does not help, so the cell is ` +
          `left unmeasured:`,
      );
      L.push("");
      for (const r of failed)
        L.push(
          `- \`${r.label}\`: exits ${r.deterministicFailure.status} ` +
            `(${r.deterministicFailure.kind}) on every run`,
        );
      L.push("");
    }
  }

  // ── raw samples ───────────────────────────────────────────────────────────
  L.push(`## Raw samples (ms)`);
  L.push("");
  L.push(`| Cell | runs | median | min |`);
  L.push(`| --- | --- | --- | --- |`);
  for (const k of Object.keys(results).sort()) {
    const r = results[k];
    L.push(
      `| \`${k}\` | ${r.samples.map((x) => x.toFixed(0)).join(", ") || "—"} ` +
        `| ${s(r.median)} | ${s(r.min)} |`,
    );
  }
  L.push("");
  return L.join("\n");
}

function printConfigTable() {
  process.stdout.write(`\nttsc matrix benchmark — project config\n\n`);
  for (const [name, cfg] of Object.entries(PROJECTS)) {
    process.stdout.write(
      `${name}  [${cfg.kind}]  branches: ${cfg.branches.join(", ")}\n`,
    );
    process.stdout.write(`  repo: ${cfg.repo}\n`);
    if (cfg.prerequisites?.length)
      process.stdout.write(`  prerequisites: ${cfg.prerequisites.join(", ")}\n`);
    for (const c of cfg.cases) {
      process.stdout.write(
        `  case ${c.name}: emit=${c.emit} singleThreaded=${c.singleThreaded}` +
          `${c.cwd ? ` cwd=${c.cwd}` : ""}\n`,
      );
      process.stdout.write(`    legacy: ${c.legacy?.build ?? "—"}\n`);
      process.stdout.write(
        `    ttsc:   ${c.ttsc?.build ?? "—"}` +
          `${c.ttsc?.noEmit ? `  |  noEmit: ${c.ttsc.noEmit}` : ""}\n`,
      );
    }
    process.stdout.write("\n");
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

function main() {
  const started = new Date();
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  // Prior results merge in so projects can be measured across invocations.
  const jsonPath = OUT.replace(/\.md$/, ".json");
  let results = {};
  if (fs.existsSync(jsonPath)) {
    try {
      results = JSON.parse(fs.readFileSync(jsonPath, "utf8")).results ?? {};
    } catch {
      results = {};
    }
  }

  // Step 1 — tarballs (skipped by --no-setup, which assumes clones are ready).
  if (!flags.has("--no-setup")) {
    packTarballs();
  }

  // Steps 2 + 3 — clone + install every (project, branch).
  const ready = {}; // project -> Set<branch> that installed cleanly
  if (!flags.has("--no-setup")) {
    process.stdout.write(`\n▸ cloning + installing fixtures into ${WORK}\n`);
    for (const project of wantedProjects) {
      ready[project] = new Set();
      for (const branch of PROJECTS[project].branches) {
        try {
          if (setupClone(project, branch)) ready[project].add(branch);
        } catch (err) {
          process.stdout.write(
            `  ⚠ ${project}@${branch}: setup failed — ${err.message}\n`,
          );
        }
      }
    }
  } else {
    // --no-setup: trust whatever clones already exist on disk.
    for (const project of wantedProjects) {
      ready[project] = new Set(
        PROJECTS[project].branches.filter((b) =>
          fs.existsSync(cloneDir(project, b)),
        ),
      );
    }
  }

  if (flags.has("--setup-only")) {
    process.stdout.write(`\n✓ setup complete — clones in ${WORK}\n`);
    return;
  }

  // Step 4 — measure.
  for (const project of wantedProjects) {
    for (const c of PROJECTS[project].cases) {
      for (const branch of PROJECTS[project].branches) {
        if (!ready[project]?.has(branch)) continue;
        measureCase(results, project, branch, c);
      }
    }
  }

  // Report.
  const host = hostSpec(wantedProjects);
  const report = buildReport(results, started, host);
  fs.writeFileSync(OUT, report);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ started, host, results }, null, 2),
  );
  process.stdout.write(`\n${report}\n\nReport written to ${OUT}\n`);
}

main();
