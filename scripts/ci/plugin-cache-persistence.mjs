// Regression harness for issue #326: a source plugin must build ONCE per
// workspace and be reused across every package, for every workspace-capable
// package manager (pnpm, yarn, bun, npm) — never rebuilt per package or per
// process. This is the exact shape that made split-CI feel like ttsc rebuilt
// the Go plugin for every phase.
//
// It scaffolds a real workspace monorepo whose two packages both consume one
// real Go source plugin, installs it with the chosen package manager (so the
// plugin resolves through that manager's real symlink/hoist layout), then:
//   1. builds package `a` in a fresh process   → expects a COLD build,
//   2. builds package `b` in a separate process → expects a CACHE HIT (no cold
//      build), proving the workspace-root `node_modules/.cache/ttsc` is shared,
//   3. asserts the compiled binary lives under that workspace-local cache and
//      that NOTHING was written to a global user cache.
//
// Usage: node scripts/ci/plugin-cache-persistence.mjs --pm=pnpm|yarn|bun|npm
//
// Requires a real Go toolchain via TTSC_GO_BINARY (as the test workflows set
// it) and a built current-platform ttsc (`pnpm run build:current`).

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const TTSC_BIN = path.join(
  REPO_ROOT,
  "packages",
  "ttsc",
  "lib",
  "launcher",
  "ttsc.js",
);
const FIXTURE_GO_PLUGIN = path.join(
  REPO_ROOT,
  "tests",
  "projects",
  "go-source-plugin",
  "go-plugin",
);
const NATIVE_BINARY = path.join(
  REPO_ROOT,
  "packages",
  `ttsc-${process.platform}-${process.arch}`,
  "bin",
  process.platform === "win32" ? "ttsc.exe" : "ttsc",
);
const COLD_BUILD_MARKER = /this runs once per cache key/;

const PACKAGE_MANAGERS = new Set(["pnpm", "yarn", "bun", "npm"]);

function main() {
  const pm = parsePackageManager();
  if (!hasCommand(pm)) {
    // Local convenience: skip a manager that is not installed (bun is
    // typically absent off-CI). Each CI job installs exactly its own manager,
    // so a skip there would mean a misconfigured workflow, not a pass.
    console.log(`SKIP [${pm}]: command not found on PATH`);
    return 0;
  }

  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), `ttsc-cache-${pm}-`));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `ttsc-cache-home-`));
  try {
    scaffoldMonorepo(workdir, pm);
    install(workdir, pm);
    const env = buildEnv(home);

    const first = buildPackage(workdir, "a", env);
    expect(first.status === 0, `[${pm}] package a build failed:\n${first.stderr}`);
    expect(
      COLD_BUILD_MARKER.test(first.stderr),
      `[${pm}] package a was expected to COLD-build the source plugin, but no ` +
        `"once per cache key" marker appeared:\n${first.stderr}`,
    );
    expectPluginOutput(workdir, "a", pm);

    const second = buildPackage(workdir, "b", env);
    expect(
      second.status === 0,
      `[${pm}] package b build failed:\n${second.stderr}`,
    );
    expect(
      !COLD_BUILD_MARKER.test(second.stderr),
      `[${pm}] package b REBUILT the source plugin instead of reusing the ` +
        `workspace cache — this is the #326 regression:\n${second.stderr}`,
    );
    expectPluginOutput(workdir, "b", pm);

    expectWorkspaceLocalCache(workdir, pm);
    expectNoGlobalCache(home, pm);

    console.log(
      `OK [${pm}]: source plugin built once and reused across workspace ` +
        `packages; cache is workspace-local, nothing written globally.`,
    );
    return 0;
  } finally {
    rmrf(workdir);
    rmrf(home);
  }
}

function parsePackageManager() {
  const arg = process.argv.slice(2).find((a) => a.startsWith("--pm="));
  const pm = arg ? arg.slice("--pm=".length) : "";
  if (!PACKAGE_MANAGERS.has(pm)) {
    fail(
      `usage: node scripts/ci/plugin-cache-persistence.mjs --pm=<pnpm|yarn|bun|npm> ` +
        `(got ${JSON.stringify(pm)})`,
    );
  }
  return pm;
}

/**
 * Write a two-package workspace monorepo whose packages both depend on one
 * workspace-internal Go source plugin. The workspace-root markers
 * (`pnpm-workspace.yaml` for pnpm, `workspaces` in package.json otherwise) make
 * ttsc resolve ONE cache root at `<workdir>/node_modules/.cache/ttsc`.
 */
function scaffoldMonorepo(workdir, pm) {
  // npm and Yarn Classic (1.x) link workspace packages by a plain version
  // range; pnpm and bun use the `workspace:` protocol.
  const workspaceDep = pm === "pnpm" || pm === "bun" ? "workspace:*" : "*";

  writeJson(path.join(workdir, "package.json"), {
    name: "@cachetest/monorepo",
    private: true,
    ...(pm === "pnpm" ? {} : { workspaces: ["packages/*"] }),
  });
  if (pm === "pnpm") {
    fs.writeFileSync(
      path.join(workdir, "pnpm-workspace.yaml"),
      'packages:\n  - "packages/*"\n',
      "utf8",
    );
  }

  // Plugin package: wraps the real Go source plugin fixture + a JS descriptor.
  const pluginDir = path.join(workdir, "packages", "go-plugin");
  fs.mkdirSync(pluginDir, { recursive: true });
  writeJson(path.join(pluginDir, "package.json"), {
    name: "@cachetest/go-plugin",
    version: "0.0.0",
    // `main` is the plugin descriptor entry: ttsc bare-resolves the specifier
    // `@cachetest/go-plugin` and calls the exported factory with its context.
    main: "plugin.cjs",
  });
  fs.writeFileSync(
    path.join(pluginDir, "plugin.cjs"),
    'const path = require("node:path");\n' +
      "module.exports = (context) => ({\n" +
      '  name: "cachetest-go-plugin",\n' +
      '  source: path.resolve(context.dirname, "go-plugin"),\n' +
      "});\n",
    "utf8",
  );
  copyDir(FIXTURE_GO_PLUGIN, path.join(pluginDir, "go-plugin"));

  // Two consumer packages, byte-identical plugin usage → one cache key.
  for (const name of ["a", "b"]) {
    const dir = path.join(workdir, "packages", name);
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    writeJson(path.join(dir, "package.json"), {
      name: `@cachetest/${name}`,
      version: "0.0.0",
      dependencies: { "@cachetest/go-plugin": workspaceDep },
    });
    writeJson(path.join(dir, "tsconfig.json"), {
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@cachetest/go-plugin" }],
      },
      include: ["src"],
    });
    fs.writeFileSync(
      path.join(dir, "src", "main.ts"),
      'export const value: string = goUpper("plugin");\nconsole.log(value);\n',
      "utf8",
    );
  }
}

function install(workdir, pm) {
  const commands = {
    pnpm: ["pnpm", ["install", "--no-frozen-lockfile"]],
    yarn: ["yarn", ["install", "--no-lockfile"]],
    bun: ["bun", ["install"]],
    npm: ["npm", ["install", "--no-audit", "--no-fund"]],
  };
  const [command, args] = commands[pm];
  // Package-manager launchers are `.cmd` shims on Windows, so they must go
  // through the shell there; node spawns (buildPackage) never do, since
  // process.execPath contains a space.
  const result = run(command, args, { cwd: workdir, shell: onWindows() });
  expect(
    result.status === 0,
    `[${pm}] install failed:\n${result.stdout}\n${result.stderr}`,
  );
}

function buildEnv(home) {
  const env = { ...process.env };
  // Exercise the DEFAULT (workspace-local) cache: strip any override so the
  // harness proves the out-of-the-box behavior CI users get.
  delete env.TTSC_CACHE_DIR;
  delete env.TTSC_GO_CACHE_DIR;
  delete env.GOCACHE;
  // Redirect every "global cache" location at an isolated, initially-empty
  // home so expectNoGlobalCache can prove nothing leaked out of the workspace.
  env.HOME = home;
  env.USERPROFILE = home;
  env.XDG_CACHE_HOME = path.join(home, ".cache");
  env.LOCALAPPDATA = path.join(home, "AppData", "Local");
  env.TTSC_BINARY = NATIVE_BINARY;
  // CI sets TTSC_GO_BINARY as `$(go env GOROOT)/bin/go`; on Windows the real
  // executable is `go.exe`. Normalize so the workflow can set it uniformly.
  if (env.TTSC_GO_BINARY) {
    env.TTSC_GO_BINARY = normalizeGoBinary(env.TTSC_GO_BINARY);
  }
  // The scaffolded consumer projects do not install `typescript`; point ttsc at
  // the repo's tsgo binary directly, exactly as the e2e suite does. This keeps
  // the harness about the plugin CACHE, not the typescript-install UX.
  env.TTSC_TSGO_BINARY = resolveTsgoBinary();
  return env;
}

function normalizeGoBinary(goBinary) {
  if (fs.existsSync(goBinary)) {
    return goBinary;
  }
  if (onWindows() && !/\.exe$/i.test(goBinary) && fs.existsSync(`${goBinary}.exe`)) {
    return `${goBinary}.exe`;
  }
  return goBinary;
}

function resolveTsgoBinary() {
  const requireFromRepo = createRequire(path.join(REPO_ROOT, "package.json"));
  const typescriptPackageJson = requireFromRepo.resolve(
    "typescript/package.json",
    { paths: [REPO_ROOT] },
  );
  const requireFromTypescript = createRequire(typescriptPackageJson);
  const platformPackageJson = requireFromTypescript.resolve(
    `@typescript/typescript-${process.platform}-${process.arch}/package.json`,
  );
  return path.join(
    path.dirname(platformPackageJson),
    "lib",
    process.platform === "win32" ? "tsc.exe" : "tsc",
  );
}

function buildPackage(workdir, name, env) {
  const cwd = path.join(workdir, "packages", name);
  return run(process.execPath, [TTSC_BIN, "--cwd", cwd, "--emit"], { cwd, env });
}

function expectPluginOutput(workdir, name, pm) {
  const out = path.join(workdir, "packages", name, "dist", "main.js");
  expect(fs.existsSync(out), `[${pm}] package ${name} emitted no dist/main.js`);
  const text = fs.readFileSync(out, "utf8");
  expect(
    /"PLUGIN"/.test(text),
    `[${pm}] package ${name} output was not transformed by the plugin ` +
      `(expected "PLUGIN"):\n${text}`,
  );
}

function expectWorkspaceLocalCache(workdir, pm) {
  const pluginRoot = path.join(
    workdir,
    "node_modules",
    ".cache",
    "ttsc",
    "plugins",
  );
  expect(
    fs.existsSync(pluginRoot),
    `[${pm}] expected the workspace-local plugin cache at ${pluginRoot}`,
  );
  const binaries = fs
    .readdirSync(pluginRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) =>
      fs.existsSync(
        path.join(
          pluginRoot,
          entry.name,
          process.platform === "win32" ? "plugin.exe" : "plugin",
        ),
      ),
    );
  // Exactly one content-keyed binary — both packages shared it.
  expect(
    binaries.length === 1,
    `[${pm}] expected exactly ONE cached plugin binary (shared by both ` +
      `packages), found ${binaries.length}`,
  );
}

function expectNoGlobalCache(home, pm) {
  const suspects = [
    path.join(home, ".cache", "ttsc"),
    path.join(home, "AppData", "Local", "ttsc"),
    path.join(home, "Library", "Caches", "ttsc"),
  ];
  for (const suspect of suspects) {
    expect(
      !fs.existsSync(suspect),
      `[${pm}] a global cache was written at ${suspect}; the cache must stay ` +
        `inside the workspace`,
    );
  }
}

// ---- small utilities -------------------------------------------------------

function run(command, args, options = {}) {
  const { shell = false, ...rest } = options;
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    shell,
    ...rest,
  });
}

function onWindows() {
  return process.platform === "win32";
}

function hasCommand(command) {
  // `<pm> --version` exits 0 only when the launcher is actually present. Under
  // a Windows shell a missing command exits non-zero without setting `.error`,
  // so gate strictly on a zero exit.
  const probe = run(command, ["--version"], { shell: onWindows() });
  return !probe.error && probe.status === 0;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

function rmrf(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; a leaked temp dir must not fail the run.
  }
}

function expect(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

process.exit(main());
