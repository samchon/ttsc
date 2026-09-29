const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const platformKey = `${process.platform}-${process.arch}`;
const platformDir = path.join(root, "packages", `ttsc-${platformKey}`);

// The platform package carries the native ttsc compiler binary; it is marked
// PLATFORM and always built before any package whose own build runs `ttsc`
// (e.g. @ttsc/graph, lint-contributor-demo).
const PLATFORM = Symbol("platform");

// `TTSC_BUILD_SCOPE` trims the build to what a given test or experiment lane
// actually exercises. The heavy cost in a full build is @ttsc/graph (its build
// runs `ttsc` with the typia plugin) plus the native binary; scoped lanes skip
// packages they never package or execute.
const SCOPES = {
  "install-smoke": ["ttsc", PLATFORM],
  "go-tests": ["ttsc", "@ttsc/lint", "@ttsc/evidence"],
  // Everything, in dependency-safe order (native binary before graph/demo).
  // @ttsc/wasm is built types-only (`build:ts`, no Go→WASM binary) and
  // @ttsc/playground after it, so the test-playground typecheck + feature lanes
  // (and local `pnpm test`) can import the built playground lib without a real
  // WASM build.
  full: [
    "ttsc",
    "@ttsc/factory",
    "@ttsc/banner",
    "@ttsc/lint",
    "@ttsc/unplugin",
    "@ttsc/metro",
    PLATFORM,
    "@ttsc/graph",
    "lint-contributor-demo",
    { filter: "@ttsc/wasm", script: "build:ts" },
    "@ttsc/playground",
    "@ttsc/evidence",
    // VS Code packaging temporarily rewrites its package.json. No other pnpm
    // build may resolve the workspace while that manifest has another name.
    "@ttsc/vscode",
  ],
  // test-ttsc drives ttsc + the banner/lint native plugins and asserts on the
  // @ttsc/vscode install artifact (its .vsix); it never touches graph/metro/
  // unplugin.
  "test-ttsc": ["ttsc", "@ttsc/banner", "@ttsc/lint", "@ttsc/evidence", "@ttsc/vscode", PLATFORM],
  // test-lint drives ttsc + the lint engine, references @ttsc/banner, and builds
  // the contributor demo plugin.
  "test-lint": [
    "ttsc",
    "@ttsc/banner",
    "@ttsc/lint",
    PLATFORM,
    "lint-contributor-demo",
  ],
  // Package-owned feature defenses share one current-platform compiler build.
  // The remaining entries are small TypeScript-only packages; co-locating them
  // avoids four separate installs/jobs without adding another native build.
  "test-packages": [
    "ttsc",
    "@ttsc/factory",
    "@ttsc/banner",
    PLATFORM,
    { filter: "@ttsc/wasm", script: "build:ts" },
    "@ttsc/playground",
  ],
  "test-metro": [
    "ttsc",
    "@ttsc/banner",
    "@ttsc/unplugin",
    "@ttsc/metro",
    PLATFORM,
  ],
  "test-unplugin": [
    "ttsc",
    "@ttsc/banner",
    "@ttsc/unplugin",
    PLATFORM,
  ],
  "test-graph": ["ttsc", PLATFORM, "@ttsc/graph"],
  // The evidence suites drive ttsc plus the lint engine the contributor's rules
  // link into, and the benchmark suite materializes workspaces that install the
  // contributor itself. Those workspaces also install this repository's own
  // toolchain from locally packed tarballs rather than from the registry, so
  // @ttsc/unplugin has to be built here too: the delivered frontend type-checks
  // `vite.config.ts`, which imports `@ttsc/unplugin/vite`, and packing that
  // package unbuilt ships a tarball with no `lib` at all.
  //
  // @ttsc/graph and the ttscgraph binary join them because this is the one
  // suite that drives a resident graph session over a real evidence project,
  // which is the only arrangement where the chain from a rule's published units
  // to a graph node runs end to end. Trimming either back leaves that case
  // resolving a module that was never built.
  "test-evidence": [
    "ttsc",
    "@ttsc/lint",
    "@ttsc/unplugin",
    "@ttsc/evidence",
    PLATFORM,
    "@ttsc/graph",
  ],
  // The website redraws the evidence benchmark charts from the tracked
  // aggregate at deploy time, and that renderer runs under `ttsx`. Nothing on
  // that path compiles a plugin, so the launcher and the compiler it drives are
  // the whole requirement.
  "website-charts": ["ttsc", PLATFORM],
  // The persistence harness only builds and runs source plugins through ttsc.
  // Building every unrelated workspace package six times obscured the cache
  // invariant behind roughly forty runner-minutes of setup.
  "plugin-cache": ["ttsc", PLATFORM],
  // Experimental tarball smoke tests pack only ttsc, the current platform, and
  // first-party packages consumed by the install/unplugin checks. paths/strip
  // ship source files directly and have no build script.
  experimental: [
    "ttsc",
    "@ttsc/banner",
    "@ttsc/lint",
    "@ttsc/unplugin",
    PLATFORM,
  ],
};

// Most focused lanes only execute `ttsc`; linking the server and graph binaries
// in every one of those jobs is another independent Go build with no consumer.
// Broad compiler coverage and the graph lane retain the binaries they exercise.
const PLATFORM_TARGETS = {
  "test-lint": "ttsc",
  "test-packages": "ttsc",
  "test-metro": "ttsc",
  "test-unplugin": "ttsc",
  "plugin-cache": "ttsc",
  "website-charts": "ttsc",
  experimental: "ttsc",
  "test-graph": "ttsc,ttscgraph",
  "test-evidence": "ttsc,ttscgraph",
};

/** Select a dependency-safe build union without rebuilding shared packages. */
function selectBuild(scope) {
  const scopes = scope.split(",");
  const requested = scopes.map((entry) => SCOPES[entry]);
  const plan = requested.some((entry) => entry === undefined)
    ? undefined
    : SCOPES.full.filter((target) => requested.some((entries) => entries.some((entry) =>
        entry === target || (typeof entry === "object" && typeof target === "object" && entry.filter === target.filter && entry.script === target.script))));
  if (plan === undefined) {
    throw new Error(
      `Unknown TTSC_BUILD_SCOPE "${scope}"; expected one of ${Object.keys(SCOPES).join(", ")}`,
    );
  }

  const nativeScopes = scopes.filter((entry) => SCOPES[entry].includes(PLATFORM));
  return { plan, platformTargets: nativeScopes.some((entry) => PLATFORM_TARGETS[entry] === undefined)
    ? undefined
    : [...new Set(nativeScopes.flatMap((entry) => PLATFORM_TARGETS[entry].split(",")))] };
}

async function main() {
  if (!fs.existsSync(path.join(platformDir, "package.json")))
    throw new Error(`Unsupported current platform package: ttsc-${platformKey}`);
  const { plan, platformTargets } = selectBuild(process.env.TTSC_BUILD_SCOPE || "full");
  const workers = Number(process.env.TTSC_BUILD_WORKERS ?? 1);
  if (!Number.isSafeInteger(workers) || workers < 1)
    throw new Error("TTSC_BUILD_WORKERS must be a positive integer");
  if (workers > 1) {
    const failed = await runBuildPlan(
      plan,
      buildDependencies(plan),
      (target) => runAsync(target, platformTargets),
      workers,
    );
    if (failed.length) {
      console.error(`Failed builds: ${failed.map(targetName).join(", ")}`);
      process.exitCode = 1;
    }
    return;
  }
  for (const target of plan) {
    if (target === PLATFORM) {
      run(
        ["--dir", platformDir, "build"],
        platformTargets === undefined
          ? {}
          : { TTSC_PLATFORM_BUILD_TARGETS: platformTargets.join(",") },
      );
    } else if (typeof target === "object") {
      // `{ filter, script }` — build a package via a non-default script (e.g.
      // @ttsc/wasm's `build:ts`, which skips the heavy Go→WASM binary build).
      run(["--filter", target.filter, target.script]);
    } else {
      run(["--filter", target, "build"]);
    }
  }
}

function targetName(target) {
  return target === PLATFORM
    ? "current platform"
    : typeof target === "object"
      ? target.filter
      : target;
}

// Package manifest edges protect import order. Graph also runs the installed
// native compiler, whose platform-package dependency is implicit in its script.
function buildDependencies(plan) {
  const targets = new Map(plan.map((target) => [targetName(target), target]));
  const manifests = new Map();
  for (const directory of ["packages", "tests"])
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const file = path.join(root, directory, entry.name, "package.json");
      if (!fs.existsSync(file)) continue;
      const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
      manifests.set(manifest.name, manifest);
    }
  const dependencies = new Map();
  for (const target of plan) {
    if (target === PLATFORM) {
      dependencies.set(target, []);
      continue;
    }
    const name = targetName(target);
    const manifest = manifests.get(name);
    if (!manifest) throw new Error(`missing build manifest for ${name}`);
    const declared = new Set(
      ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]
        .flatMap((field) => Object.keys(manifest[field] ?? {})),
    );
    const parents = [...declared]
      .filter((dependency) => targets.has(dependency))
      .map((dependency) => targets.get(dependency));
    if (targets.has("current platform") && name === "@ttsc/graph")
      parents.push(PLATFORM);
    if (name === "@ttsc/vscode")
      for (const other of plan)
        if (other !== target && !parents.includes(other)) parents.push(other);
    dependencies.set(target, parents);
  }
  return dependencies;
}

// Only build tasks with successful prerequisites can enter the bounded worker
// pool. Independent tasks still reach a verdict after a sibling fails.
async function runBuildPlan(plan, dependencies, execute, workers) {
  if (!Number.isSafeInteger(workers) || workers < 1)
    throw new Error("build workers must be a positive integer");
  const position = new Map(plan.map((target, index) => [target, index]));
  for (const target of plan)
    for (const parent of dependencies.get(target) ?? [])
      if (!position.has(parent) || position.get(parent) >= position.get(target))
        throw new Error(`build dependency must precede ${targetName(target)}: ${targetName(parent)}`);
  let active = 0;
  const waiting = [];
  async function withWorker(task) {
    if (active >= workers) await new Promise((resolve) => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      if (waiting.length) waiting.shift()();
      else active--;
    }
  }
  const started = new Map();
  function start(target) {
    if (started.has(target)) return started.get(target);
    const result = (async () => {
      const statuses = await Promise.all((dependencies.get(target) ?? []).map(start));
      if (statuses.some((status) => status !== 0)) {
        console.error(`Build blocked by failed prerequisite: ${targetName(target)}`);
        return 1;
      }
      try {
        return await withWorker(() => execute(target));
      } catch (error) {
        console.error(error);
        return 1;
      }
    })();
    started.set(target, result);
    return result;
  }
  const statuses = await Promise.all(plan.map(start));
  return plan.filter((_, index) => statuses[index] !== 0);
}

function runAsync(target, platformTargets) {
  let args;
  let extraEnv = {};
  if (target === PLATFORM) {
    args = ["--dir", platformDir, "build"];
    if (platformTargets !== undefined)
      extraEnv = { TTSC_PLATFORM_BUILD_TARGETS: platformTargets.join(",") };
  } else if (typeof target === "object")
    args = ["--filter", target.filter, target.script];
  else args = ["--filter", target, "build"];
  const started = process.hrtime.bigint();
  console.log(`Building ${targetName(target)}`);
  return new Promise((resolve) => {
    const child = cp.spawn(...pnpmCommand(args), {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", (error) => console.error(error));
    child.on("close", (code) => {
      const seconds = Number(process.hrtime.bigint() - started) / 1e9;
      console.log(`Build finished: ${targetName(target)}: ${code === 0 ? "passed" : "FAILED"} in ${seconds.toFixed(1)} s`);
      resolve(code ?? 1);
    });
  });
}

function run(args, extraEnv = {}) {
  const result = cp.spawnSync(...pnpmCommand(args), {
    cwd: root,
    env: {
      ...process.env,
      ...extraEnv,
    },
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function pnpmCommand(args) {
  if (process.platform !== "win32") {
    return ["pnpm", args];
  }
  return ["cmd.exe", ["/d", "/s", "/c", "pnpm", ...args]];
}

if (require.main === module)
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

module.exports = { PLATFORM, PLATFORM_TARGETS, SCOPES, selectBuild, buildDependencies, runBuildPlan };
