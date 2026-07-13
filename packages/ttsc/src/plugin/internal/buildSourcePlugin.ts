import {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
  spawnSync,
} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { findNearestGoMod } from "../../compiler/internal/paths";

const GO_MOD_SEARCH_MAX_DEPTH = 3;
const TTSC_GO_MODULE_PATH = "github.com/samchon/ttsc/packages/ttsc";
const TSGO_GO_MODULE_PATH = "github.com/microsoft/typescript-go";

const PRUNE_DIRS = new Set(["node_modules", ".git", ".ttsc"]);
const GENERATED_WORKSPACE_FILES = new Set(["go.work", "go.work.sum"]);

// Go build environment values that can change the produced binary or decide
// whether `go build` succeeds. Hashed into the plugin cache key so target,
// build-tag, cgo, FIPS, and external-link variants never collide.
const GO_BUILD_ENV_KEYS: readonly string[] = [
  "GOOS",
  "GOARCH",
  "GOAMD64",
  "GOARM",
  "GOARM64",
  "GO386",
  "GOMIPS",
  "GOMIPS64",
  "GOPPC64",
  "GORISCV64",
  "GOWASM",
  "GOFLAGS",
  "GOEXPERIMENT",
  "GOFIPS140",
  "GO_EXTLINK_ENABLED",
  "GCCGO",
  "GCCGOTOOLDIR",
  "CGO_ENABLED",
  "AR",
  "CC",
  "CXX",
  "FC",
  "PKG_CONFIG",
  "CGO_CFLAGS",
  "CGO_CFLAGS_ALLOW",
  "CGO_CFLAGS_DISALLOW",
  "CGO_CPPFLAGS",
  "CGO_CPPFLAGS_ALLOW",
  "CGO_CPPFLAGS_DISALLOW",
  "CGO_CXXFLAGS",
  "CGO_CXXFLAGS_ALLOW",
  "CGO_CXXFLAGS_DISALLOW",
  "CGO_FFLAGS",
  "CGO_FFLAGS_ALLOW",
  "CGO_FFLAGS_DISALLOW",
  "CGO_LDFLAGS",
  "CGO_LDFLAGS_ALLOW",
  "CGO_LDFLAGS_DISALLOW",
  "GOTOOLCHAIN",
  "GOROOT",
];
const GO_BUILD_COMMAND_ENV_KEYS = new Set([
  "AR",
  "CC",
  "CXX",
  "FC",
  "GCCGO",
  "PKG_CONFIG",
]);
const EXTERNAL_GO_BUILD_ENV_KEYS: readonly string[] = [
  "CPATH",
  "C_INCLUDE_PATH",
  "CPLUS_INCLUDE_PATH",
  "DYLD_LIBRARY_PATH",
  "INCLUDE",
  "LD_LIBRARY_PATH",
  "LIB",
  "LIBRARY_PATH",
  "LIBPATH",
  "MACOSX_DEPLOYMENT_TARGET",
  "OBJC_INCLUDE_PATH",
  "PKG_CONFIG_ALLOW_SYSTEM_CFLAGS",
  "PKG_CONFIG_ALLOW_SYSTEM_LIBS",
  "PKG_CONFIG_LIBDIR",
  "PKG_CONFIG_PATH",
  "PKG_CONFIG_SYSROOT_DIR",
  "PKG_CONFIG_TOP_BUILD_DIR",
  "SDKROOT",
];
const CONTRIBUTIONS_FILE_NAME = "ttsc_contributions.go";
const CONTRIB_DIRNAME = "contrib";
// A cold source-plugin build is a multi-second-to-minutes `go build`. When a
// program fans out into many processes (a `pnpm -r` running several suites in
// parallel, a benchmark, a worker pool), each inherits the same cold cache and
// would otherwise launch its own full build of the SAME cache key at the same
// instant. The atomic lock below lets one process build while the rest poll for
// its published binary, so the toolchain runs once per cache key instead of N
// times. A waiter steals an abandoned lock (builder crashed) after this timeout
// so a fan-out never wedges; it matches the dependency-build lock in
// runtimeHooks.ts.
const PLUGIN_BUILD_LOCK_STEAL_MS = 600_000;
const PLUGIN_BUILD_LOCK_POLL_MS = 50;
const PLUGIN_BUILD_LOCK_LEGACY_STALE_MS = 30_000;
const PLUGIN_BUILD_LOCK_STATUS_MS = 30_000;
const PLUGIN_BUILD_LOCK_OWNER_FILE = "owner.json";
// The default cache lives INSIDE the workspace, at
// `<workspaceRoot>/node_modules/.cache/ttsc`, so `rm -rf node_modules` (or
// deleting the repo) reclaims every compiled plugin binary and Go object file.
// This is the `find-cache-dir` convention (Babel, webpack, ESLint, Nuxt, …): a
// disposable build cache under `node_modules/.cache/<tool>`. ttsc keeps NO
// global (`~/.cache`) cache — a machine-wide cache silently grew to hundreds of
// GB across tsgo/plugin version bumps, so it was removed outright. See
// resolveSourceBuildCacheRoot for the (override → workspace-local) priority.
const NODE_MODULES_DIRNAME = "node_modules";
const LOCAL_CACHE_PARENT_DIRNAME = ".cache";
const TTSC_CACHE_DIRNAME = "ttsc";
const PLUGIN_CACHE_DIRNAME = "plugins";
const GO_BUILD_CACHE_DIRNAME = "go-build";
// Directories whose presence marks a monorepo/workspace root, so every package
// in the workspace shares ONE cache and a plugin builds once, not once per
// package. `package.json` with a `workspaces` field (yarn/npm/bun) is checked
// separately in isWorkspaceRootDir.
const WORKSPACE_ROOT_MARKER_FILES: readonly string[] = ["pnpm-workspace.yaml"];
const CACHE_LAST_USED_FILE = ".last-used";
const CACHE_GC_MARKER_FILE = ".gc-last-run";
// The plugin binary cache is content-keyed, so a project that bumps tsgo/typia
// many times leaves one stale entry per superseded key. An opportunistic GC
// (once/day) evicts entries unused for 30 days and, past a 2 GB ceiling, the
// least-recently-used down to 80%. It is scoped to the resolved cache root only
// — ttsc never scans a shared or global location.
const PLUGIN_CACHE_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const PLUGIN_CACHE_ENTRY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PLUGIN_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const PLUGIN_CACHE_TARGET_BYTES = Math.floor(PLUGIN_CACHE_MAX_BYTES * 0.8);
const PLUGIN_CACHE_PROTECTED_AGE_MS = 60 * 60 * 1000;

/** One contributor's resolved Go source plus its target sub-package name. */
export interface ITtscBuildContributor {
  /** Sub-package suffix: scratch lands at `<host>/contrib/<name>/`. */
  name: string;
  /** Absolute path to the contributor's source directory. */
  source: string;
}

/** Source-plugin cache locations resolved for one ttsc invocation. */
export interface ITtscSourceBuildCachePaths {
  /** Root directory containing all ttsc-owned source build caches. */
  root: string;
  /** Directory containing content-addressed compiled plugin binaries. */
  pluginRoot: string;
  /** Directory passed to Go as `GOCACHE` for source-plugin builds. */
  goBuildRoot: string;
  /** How `goBuildRoot` was selected. */
  goBuildRootSource: "ttsc-cache" | "TTSC_GO_CACHE_DIR" | "GOCACHE";
}

/** Build one Go source plugin into a cached executable. */
export function buildSourcePlugin(opts: {
  source: string;
  pluginName: string;
  baseDir: string;
  cacheDir?: string;
  contributors?: readonly ITtscBuildContributor[];
  label?: string;
  overlayDirs?: readonly string[];
  quiet?: boolean;
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const { dir, entry, source } = resolveSourceBuildTarget(opts);
  const overlayDirs = [...(opts.overlayDirs ?? findTtscOverlayDirs())].sort();
  const contributors = opts.contributors ?? [];
  const goBinary = resolveGoCompiler();
  ensureExecutableGoToolchain(goBinary);
  const key = computeCacheKey({
    contributors,
    dir,
    entry,
    goBinary,
    overlayDirs,
    ttscVersion: opts.ttscVersion,
    tsgoVersion: opts.tsgoVersion,
  });
  const paths = resolveSourceBuildCachePaths(opts.baseDir, opts.cacheDir);
  maybePrunePluginCache(paths, opts.cacheDir);
  const cacheDir = path.join(paths.pluginRoot, key);
  const binaryName = process.platform === "win32" ? "plugin.exe" : "plugin";
  const binaryPath = path.join(cacheDir, binaryName);
  if (fs.existsSync(binaryPath)) {
    touchCacheEntry(cacheDir);
    return binaryPath;
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const label = opts.label ?? "source plugin";
  const quiet = opts.quiet === true;
  return buildUnderPluginLock(
    cacheDir,
    binaryPath,
    { label, pluginName: opts.pluginName, quiet },
    () =>
      compileSourcePlugin({
        binaryPath,
        cacheDir,
        contributors,
        dir,
        entry,
        goBinary,
        key,
        label,
        goBuildCacheRoot: paths.goBuildRoot,
        overlayDirs,
        pluginName: opts.pluginName,
        quiet,
        source,
      }),
  );
}

/** Run the actual `go build` and publish the binary; assumes the lock is held. */
function compileSourcePlugin(opts: {
  binaryPath: string;
  cacheDir: string;
  contributors: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  goBinary: string;
  goBuildCacheRoot: string;
  key: string;
  label: string;
  overlayDirs: readonly string[];
  pluginName: string;
  quiet: boolean;
  source: string;
}): string {
  if (!opts.quiet) {
    const extra =
      opts.contributors.length === 0
        ? ""
        : ` + ${opts.contributors.length} contributor(s): ${opts.contributors
            .map((c) => c.name)
            .join(", ")}`;
    process.stderr.write(
      `ttsc: building ${opts.label} "${opts.pluginName}" from ${opts.source}${extra} ` +
        `(this runs once per cache key and can take several minutes on a cold Go cache)\n`,
    );
  }

  const scratchDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `ttsc-plugin-${opts.key}-`),
  );
  try {
    materializeScratchDir(opts.dir, scratchDir);
    const goModReader = createGoModReader(opts.goBinary, opts.pluginName);
    if (opts.contributors.length > 0) {
      mergeContributors({
        contributors: opts.contributors,
        entry: opts.entry,
        goModReader,
        pluginName: opts.pluginName,
        scratchDir,
      });
    }
    writeGoWork(scratchDir, opts.overlayDirs, opts.goBinary, opts.pluginName);
    const scratchBinaryName =
      process.platform === "win32" ? ".ttsc-plugin.exe" : ".ttsc-plugin";
    runGoBuild(
      scratchDir,
      opts.entry,
      scratchBinaryName,
      opts.pluginName,
      opts.goBinary,
      opts.goBuildCacheRoot,
    );
    const builtBinary = path.join(scratchDir, scratchBinaryName);
    publishBuiltBinary(builtBinary, opts.binaryPath);
    touchCacheEntry(opts.cacheDir);
    return opts.binaryPath;
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }
}

/**
 * Build a source plugin while holding an exclusive cross-process lock for its
 * cache key, so concurrent fan-out (parallel suites, a benchmark, a worker
 * pool) runs the `go build` once instead of once per process.
 *
 * The lock is an atomic `mkdir` on `<cacheDir>.lock`. The winner builds and
 * publishes the binary; every loser polls for that binary to appear and reuses
 * it. A loser distinguishes two ways the lock can stop blocking it:
 *
 * - `released`: the holder removed the lock itself — it published, or its build
 *   threw and its `finally` freed the key. The loser simply retries the
 *   ordinary acquisition; nothing is stale and nothing is reported.
 * - `abandoned`: the lock still exists but its owner is provably dead, it is an
 *   old metadata-less legacy lock, or the wait budget
 *   (`PLUGIN_BUILD_LOCK_STEAL_MS`) expired. Only then does the loser report and
 *   steal the lock before retrying.
 *
 * This is the same shape as `withBuildLock` in the runtime hooks, keyed on the
 * plugin binary's existence instead of a JSON meta marker.
 *
 * Correctness still rests on `publishBuiltBinary`'s atomic rename: the lock is
 * an optimisation to avoid duplicate work, not the only guard against a corrupt
 * binary, so a stolen lock that races a slow builder cannot ship a half-written
 * file.
 */
function buildUnderPluginLock(
  cacheDir: string,
  binaryPath: string,
  lockInfo: {
    label: string;
    pluginName: string;
    quiet: boolean;
  },
  build: () => string,
): string {
  const lockDir = `${cacheDir}.lock`;
  for (;;) {
    if (fs.existsSync(binaryPath)) {
      touchCacheEntry(cacheDir);
      return binaryPath;
    }
    try {
      // Plain mkdir (no `recursive`): recursive mode is idempotent and would
      // not throw EEXIST, defeating the lock. The parent `cacheDir` already
      // exists, so a single-level mkdir is all that is needed and its EEXIST
      // is exactly the "someone else holds the lock" signal.
      fs.mkdirSync(lockDir);
      writePluginBuildLockOwner(lockDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        // A lock dir we cannot create for an unexpected reason (e.g. a
        // read-only cache) must not silently skip the build. Fall back to an
        // unlocked build — correctness is preserved by the atomic publish.
        return build();
      }
      const waited = waitForPluginBinary({
        binaryPath,
        lockDir,
        lockInfo,
        timeoutMs: PLUGIN_BUILD_LOCK_STEAL_MS,
      });
      if (waited.outcome === "published") {
        touchCacheEntry(cacheDir);
        return binaryPath;
      }
      if (waited.outcome === "abandoned") {
        // Builder appears to have crashed: steal the abandoned lock and retry.
        reportPluginLockSteal(lockDir, binaryPath, lockInfo, waited.reason);
        fs.rmSync(lockDir, { force: true, recursive: true });
      }
      // "released" needs no repair: the holder freed the key normally (its
      // build published or failed), so retry the ordinary atomic acquisition.
      // Reporting a steal or force-removing the path here would misclassify a
      // routine handoff as abandonment (issue #421).
      continue;
    }
    try {
      // Re-check under the lock: a previous holder may have just published.
      if (fs.existsSync(binaryPath)) {
        touchCacheEntry(cacheDir);
        return binaryPath;
      }
      return build();
    } finally {
      fs.rmSync(lockDir, { force: true, recursive: true });
    }
  }
}

/**
 * Outcome of one waiting session on another process's plugin build lock.
 *
 * - `published`: the binary exists and can be reused.
 * - `released`: the observed lock no longer exists and no binary appeared — the
 *   holder freed the key normally, so the caller should retry the ordinary
 *   atomic acquisition without reporting or removing anything.
 * - `abandoned`: the lock still exists but is provably stale (dead owner, old
 *   legacy lock) or the wait budget expired; the caller may report and steal
 *   it.
 *
 * Exported for unit tests.
 */
export type PluginBinaryWaitResult =
  | { outcome: "published" }
  | { outcome: "released" }
  | { outcome: "abandoned"; reason: string };

/**
 * Poll for the locked builder to publish its binary, up to `timeoutMs`.
 *
 * Exported for unit tests.
 */
export function waitForPluginBinary(opts: {
  binaryPath: string;
  lockDir: string;
  lockInfo: {
    label: string;
    pluginName: string;
    quiet: boolean;
  };
  timeoutMs: number;
}): PluginBinaryWaitResult {
  const startedAt = Date.now();
  let nextStatusAt = startedAt + PLUGIN_BUILD_LOCK_STATUS_MS;
  for (;;) {
    if (fs.existsSync(opts.binaryPath)) {
      return { outcome: "published" };
    }
    const now = Date.now();
    const lock = inspectPluginBuildLock(opts.lockDir, now);
    if (lock.state === "released") {
      // The holder removed the lock between the binary check above and this
      // observation. That is a normal release, not abandonment: prefer the
      // binary when it landed inside that window, otherwise hand the free key
      // back to the caller.
      return fs.existsSync(opts.binaryPath)
        ? { outcome: "published" }
        : { outcome: "released" };
    }
    if (lock.state === "abandoned") {
      return { outcome: "abandoned", reason: lock.reason };
    }
    if (now - startedAt > opts.timeoutMs) {
      return {
        outcome: "abandoned",
        reason: `timed out after ${formatDuration(now - startedAt)}`,
      };
    }
    if (!opts.lockInfo.quiet && now >= nextStatusAt) {
      reportPluginLockWait({
        binaryPath: opts.binaryPath,
        elapsedMs: now - startedAt,
        lockDir: opts.lockDir,
        lockInfo: opts.lockInfo,
        owner: lock.owner,
      });
      nextStatusAt = now + PLUGIN_BUILD_LOCK_STATUS_MS;
    }
    sleepSync(PLUGIN_BUILD_LOCK_POLL_MS);
  }
}

function writePluginBuildLockOwner(lockDir: string): void {
  try {
    fs.writeFileSync(
      path.join(lockDir, PLUGIN_BUILD_LOCK_OWNER_FILE),
      `${JSON.stringify(
        {
          hostname: os.hostname(),
          pid: process.pid,
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  } catch {
    // Best-effort metadata: the mkdir lock still serializes the build.
  }
}

/**
 * One observation of a plugin build lock directory's state.
 *
 * - `active`: the lock exists and its owner is alive (or cannot be disproven:
 *   another host, no metadata but young). Keep waiting.
 * - `abandoned`: the lock still exists and the evidence says nobody will ever
 *   release it — a same-host owner that is no longer running, or an old
 *   metadata-less legacy lock. Stealing is justified.
 * - `released`: the lock directory no longer exists. The holder released it
 *   normally (its build published or failed), so this is a routine handoff —
 *   never an infinitely old abandoned lock (issue #421).
 *
 * Exported for unit tests.
 */
export type PluginBuildLockObservation =
  | { state: "active"; owner: string }
  | { state: "abandoned"; reason: string }
  | { state: "released" };

/**
 * Classify the current state of a plugin build lock directory.
 *
 * Exported for unit tests.
 */
export function inspectPluginBuildLock(
  lockDir: string,
  now: number,
): PluginBuildLockObservation {
  const owner = readPluginBuildLockOwner(lockDir);
  if (owner !== null) {
    const label = describePluginBuildLockOwner(owner);
    if (isLocalHostName(owner.hostname) && !isProcessAlive(owner.pid)) {
      return {
        state: "abandoned",
        reason: `${label} is no longer running`,
      };
    }
    return {
      state: "active",
      owner: label,
    };
  }

  const ageMs = pluginBuildLockAgeMs(lockDir, now);
  if (ageMs === null) {
    return { state: "released" };
  }
  if (ageMs > PLUGIN_BUILD_LOCK_LEGACY_STALE_MS) {
    return {
      state: "abandoned",
      reason:
        `legacy lock has no ${PLUGIN_BUILD_LOCK_OWNER_FILE} and is ` +
        `${formatDuration(ageMs)} old`,
    };
  }
  return {
    state: "active",
    owner: `legacy lock with no ${PLUGIN_BUILD_LOCK_OWNER_FILE}`,
  };
}

function readPluginBuildLockOwner(
  lockDir: string,
): { hostname: string; pid: number; startedAt?: string } | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(lockDir, PLUGIN_BUILD_LOCK_OWNER_FILE), "utf8"),
    ) as Record<string, unknown>;
    if (
      typeof parsed.hostname !== "string" ||
      !Number.isInteger(parsed.pid) ||
      typeof parsed.pid !== "number" ||
      parsed.pid <= 0
    ) {
      return null;
    }
    return {
      hostname: parsed.hostname,
      pid: parsed.pid,
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Age of the lock directory, or `null` when it no longer exists (the holder
 * released it between the caller's checks). "Missing" is a first-class
 * observation, never encoded as a numeric age: the previous
 * `Number.POSITIVE_INFINITY` encoding made a just-released lock look like an
 * infinitely old abandoned legacy lock (issue #421).
 *
 * A stat failure that does not prove absence (e.g. `EPERM`) clamps to age 0:
 * the lock is treated as fresh so a waiter never steals on ambiguous evidence,
 * while the caller's wait budget still bounds the stall.
 */
function pluginBuildLockAgeMs(lockDir: string, now: number): number | null {
  try {
    return Math.max(0, now - fs.statSync(lockDir).mtimeMs);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? null : 0;
  }
}

function isLocalHostName(hostname: string): boolean {
  return hostname.toLowerCase() === os.hostname().toLowerCase();
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function describePluginBuildLockOwner(owner: {
  hostname: string;
  pid: number;
  startedAt?: string;
}): string {
  const started =
    owner.startedAt === undefined ? "" : ` started at ${owner.startedAt}`;
  return `pid ${owner.pid} on ${owner.hostname}${started}`;
}

function reportPluginLockWait(opts: {
  binaryPath: string;
  elapsedMs: number;
  lockDir: string;
  lockInfo: {
    label: string;
    pluginName: string;
    quiet: boolean;
  };
  owner: string;
}): void {
  process.stderr.write(
    `ttsc: waiting for ${opts.lockInfo.label} "${opts.lockInfo.pluginName}" ` +
      `cache lock after ${formatDuration(opts.elapsedMs)}; ` +
      `lock=${opts.lockDir}; binary=${opts.binaryPath}; owner=${opts.owner}\n`,
  );
}

function reportPluginLockSteal(
  lockDir: string,
  binaryPath: string,
  lockInfo: {
    label: string;
    pluginName: string;
    quiet: boolean;
  },
  reason: string,
): void {
  if (lockInfo.quiet) return;
  process.stderr.write(
    `ttsc: reclaiming abandoned ${lockInfo.label} "${lockInfo.pluginName}" ` +
      `cache lock at ${lockDir}; binary=${binaryPath} (${reason})\n`,
  );
}

/**
 * Render a millisecond duration for lock diagnostics (`137ms`, `42s`, `9m 3s`).
 *
 * Total over every number: no caller produces a non-finite duration anymore
 * (the lock state machine reports "released" instead of an Infinity age), but
 * as defense in depth a non-finite input renders as `an unknown time` so no
 * public diagnostic can ever print `Infinitym NaNs` again (issue #421).
 *
 * Exported for unit tests.
 */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms)) {
    return "an unknown time";
  }
  if (ms < 1_000) {
    return `${Math.max(0, Math.round(ms))}ms`;
  }
  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${remainder}s`;
}

/** Block the current (synchronous) thread for `ms` without busy-spinning. */
function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Copy every contributor's Go source into a sub-package of the host module and
 * synthesize a blank-import file alongside the host's entry package so each
 * contributor's `init()` runs before `main`.
 *
 * - Sources land at `<scratch>/<CONTRIB_DIRNAME>/<name>/` (recursive copy with
 *   the same pruning rules used for the host source).
 * - The entry directory receives `<CONTRIBUTIONS_FILE_NAME>` containing one
 *   blank-import per contributor. The host's module path is read from the
 *   materialized go.mod, so the import path is always correct for the host
 *   plugin's actual module declaration.
 * - Contributors that ship their own `go.mod` are rejected — the design relies on
 *   the contributor living inside the host's module so that workspace overlay
 *   rules and the host's `go.sum` cover transitive dependencies. This also
 *   closes the supply-chain hole where a contributor could otherwise pull in
 *   arbitrary Go modules.
 */
function mergeContributors(opts: {
  contributors: readonly ITtscBuildContributor[];
  entry: string;
  goModReader: GoModReader;
  pluginName: string;
  scratchDir: string;
}): void {
  const hostModulePath = opts.goModReader.read(opts.scratchDir).modulePath;
  if (hostModulePath === null || hostModulePath === "") {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" cannot accept contributors because its module ` +
        `root has no resolvable go.mod module path`,
    );
  }
  const contribRoot = path.join(opts.scratchDir, CONTRIB_DIRNAME);
  // Refuse to merge when the host plugin's own source already owns a
  // `contrib/` directory. We'd otherwise silently merge contributor
  // files into a pre-populated host package and ship a hybrid binary
  // whose contents nobody declared. Loud failure is the only safe
  // option — the host plugin must rename its directory or the
  // contributor system must use a different sub-package root.
  if (fs.existsSync(contribRoot)) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" already ships a ${CONTRIB_DIRNAME}/ directory in its source; ` +
        `contributor merge would silently overwrite. Rename the host plugin's directory to a different name.`,
    );
  }
  fs.mkdirSync(contribRoot, { recursive: true });
  // Sort contributors by name so the synthesized `ttsc_contributions.go`
  // emits blank imports in a deterministic order independent of
  // declaration order. The cache key is already sort-stable
  // (`computeCacheKey` sorts contributors by name), so without this
  // matching sort the SAME cache key could correspond to two distinct
  // binaries whose `init()` sequence across contributors differs by
  // import order.
  const sortedContributors = [...opts.contributors].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const imports: string[] = [];
  for (const contributor of sortedContributors) {
    if (fs.existsSync(path.join(contributor.source, "go.mod"))) {
      throw new Error(
        `ttsc: plugin "${opts.pluginName}" contributor "${contributor.name}" must ship Go ` +
          `source as a package, not a module (go.mod found at ${contributor.source}/go.mod). ` +
          `Remove go.mod so the contributor compiles inside the host module's dependency graph.`,
      );
    }
    const target = path.join(contribRoot, contributor.name);
    if (fs.existsSync(target)) {
      // Defensive: validatePluginContributors already rejects duplicate
      // names, and the contribRoot-existence guard above blocks the
      // host plugin from pre-shipping a `contrib/` directory. Reaching
      // this branch implies an upstream contract break. Fail loud
      // rather than overwrite.
      throw new Error(
        `ttsc: plugin "${opts.pluginName}" contributor "${contributor.name}" target ${target} already exists; ` +
          `contributor names must be unique within one plugin build`,
      );
    }
    fs.cpSync(contributor.source, target, {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        if (shouldPruneDirectory(base)) return false;
        if (shouldOmitSourceFile(base)) return false;
        return true;
      },
    });
    imports.push(`${hostModulePath}/${CONTRIB_DIRNAME}/${contributor.name}`);
  }
  const entryDir = path.resolve(opts.scratchDir, opts.entry);
  fs.mkdirSync(entryDir, { recursive: true });
  const contributionsPath = path.join(entryDir, CONTRIBUTIONS_FILE_NAME);
  // Same reasoning as the contribRoot guard: when entry resolves to the
  // module root (`entry === "."`), entryDir == scratchDir and a
  // pre-existing `ttsc_contributions.go` from the host plugin's own
  // source would be silently overwritten by the generator below.
  if (fs.existsSync(contributionsPath)) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" already ships ${CONTRIBUTIONS_FILE_NAME} in its entry package; ` +
        `that filename is reserved for the contributor blank-import generator. Rename the host's file.`,
    );
  }
  writeContributionsFile(contributionsPath, imports);
}

function writeContributionsFile(filePath: string, imports: string[]): void {
  const importLines = imports
    .map((spec) => `\t_ ${JSON.stringify(spec)}`)
    .join("\n");
  const body = `// Code generated by ttsc — DO NOT EDIT.
//
// This file is synthesized by ttsc's plugin builder when the host plugin
// descriptor declares "contributors". The blank imports below pull each
// contributor sub-package into the build so its init() runs before main.

package main

import (
${importLines}
)
`;
  fs.writeFileSync(filePath, body, "utf8");
}

function publishBuiltBinary(builtBinary: string, binaryPath: string): void {
  const pending = `${binaryPath}.${process.pid}.${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.tmp`;
  fs.copyFileSync(builtBinary, pending);
  if (process.platform !== "win32") {
    fs.chmodSync(pending, 0o755);
  }
  try {
    fs.renameSync(pending, binaryPath);
  } catch (error) {
    fs.rmSync(pending, { force: true });
    const code = (error as NodeJS.ErrnoException).code;
    if (
      (code === "EEXIST" || code === "EPERM" || code === "EACCES") &&
      fs.existsSync(binaryPath)
    ) {
      return;
    }
    throw error;
  } finally {
    // Best-effort sweep of any leftover `.tmp` siblings from a prior
    // crash between copyFileSync and renameSync. Same-directory pending
    // names guarantee the rename stays a same-filesystem atomic op, so
    // we accept the GC cost rather than move pending files to os.tmpdir.
    pruneOrphanPendingBinaries(binaryPath);
  }
}

function pruneOrphanPendingBinaries(binaryPath: string): void {
  // Only sweep pending files owned by THIS process. Concurrent ttsc
  // invocations (two `ttsc --watch` shells against the same project)
  // may have their own `<binary>.<their-pid>.*.tmp` mid-flight, and
  // deleting them would race their renameSync into ENOENT.
  try {
    const dir = path.dirname(binaryPath);
    const prefix = `${path.basename(binaryPath)}.${process.pid}.`;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith(prefix) && name.endsWith(".tmp")) {
        fs.rmSync(path.join(dir, name), { force: true });
      }
    }
  } catch {
    // Best-effort; never mask the underlying publish outcome.
  }
}

function resolveSourceBuildTarget(opts: {
  source: string;
  pluginName: string;
  baseDir: string;
}): {
  dir: string;
  entry: string;
  source: string;
} {
  const source = path.isAbsolute(opts.source)
    ? opts.source
    : path.resolve(opts.baseDir, opts.source);
  if (!fs.existsSync(source)) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" source does not exist: ${source}`,
    );
  }

  const stat = fs.statSync(source);
  const packageDir =
    stat.isFile() && path.basename(source) === "go.mod"
      ? path.dirname(source)
      : stat.isDirectory()
        ? source
        : null;
  if (packageDir === null) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" source must be a Go package directory or go.mod file: ${source}`,
    );
  }

  const goMod = findNearestGoMod(packageDir, GO_MOD_SEARCH_MAX_DEPTH);
  if (goMod === null) {
    throw new Error(
      `ttsc: plugin "${opts.pluginName}" source must be inside a Go module with go.mod within ${GO_MOD_SEARCH_MAX_DEPTH} parent directories: ${source}`,
    );
  }
  const dir = path.dirname(goMod);
  const rel = path.relative(dir, packageDir).replace(/\\/g, "/");
  return {
    dir,
    entry: rel === "" ? "." : `./${rel}`,
    source,
  };
}

function materializeScratchDir(source: string, scratch: string): void {
  fs.mkdirSync(scratch, { recursive: true });
  fs.cpSync(source, scratch, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      if (shouldPruneDirectory(base)) return false;
      if (shouldOmitSourceFile(base)) return false;
      return true;
    },
  });
}

function writeGoWork(
  scratchDir: string,
  useDirs: readonly string[],
  goBinary: string,
  pluginName: string,
): void {
  const goModReader = createGoModReader(goBinary, pluginName);
  validateSourceReplacements(scratchDir, useDirs, goModReader, pluginName);
  const sourceInfo = goModReader.read(scratchDir);
  const effectiveUseDirs =
    sourceInfo.modulePath === TTSC_GO_MODULE_PATH
      ? useDirs.filter((dir) => {
          const modulePath = goModReader.read(dir).modulePath;
          return modulePath !== null && !isTtscManagedModulePath(modulePath);
        })
      : useDirs;
  const useLines = ["\t."];
  for (const dir of effectiveUseDirs) {
    useLines.push(`\t${formatGoWorkPath(dir)}`);
  }
  const replaceLines = sourceBuildWorkspaceReplacements(
    effectiveUseDirs,
    goModReader,
  );
  const replaceBlock =
    replaceLines.length === 0 ? "" : `\n\n${replaceLines.join("\n")}\n`;
  const goWork = `go 1.26\n\nuse (\n${useLines.join("\n")}\n)${replaceBlock}`;
  fs.writeFileSync(path.join(scratchDir, "go.work"), goWork, "utf8");
}

function validateSourceReplacements(
  scratchDir: string,
  useDirs: readonly string[],
  goModReader: GoModReader,
  pluginName: string,
): void {
  const sourceInfo = goModReader.read(scratchDir);
  if (sourceInfo.modulePath === TTSC_GO_MODULE_PATH) {
    return;
  }
  const sourceReplacements = sourceInfo.replacements;
  if (sourceReplacements.length === 0) {
    return;
  }
  const overlayModules = collectOverlayModulePaths(useDirs, goModReader);
  for (const replacement of sourceReplacements) {
    if (
      isTtscManagedModulePath(replacement.modulePath) ||
      overlayModules.has(replacement.modulePath)
    ) {
      throw new Error(
        `ttsc: plugin "${pluginName}" go.mod replaces ttsc-managed module ` +
          `${JSON.stringify(replacement.modulePath)}. Remove this replace directive; ` +
          `ttsc supplies its own compiler and shim modules while building source plugins.`,
      );
    }
  }
}

function sourceBuildWorkspaceReplacements(
  useDirs: readonly string[],
  goModReader: GoModReader,
): string[] {
  const ttscRoot = useDirs.find(
    (dir) => goModReader.read(dir).modulePath === TTSC_GO_MODULE_PATH,
  );
  if (!ttscRoot) {
    return [];
  }
  return [
    `replace ${TTSC_GO_MODULE_PATH} v0.0.0 => ${formatGoWorkPath(ttscRoot)}`,
  ];
}

/**
 * Format an absolute filesystem path as a single `go.work`/`go.mod` token.
 *
 * The modfile grammar shared by `go.mod` and `go.work` (parsed by
 * `golang.org/x/mod/modfile`) is whitespace-tokenized, so a `use`/`replace`
 * path that contains a space — a home or project directory such as `/Users/John
 * Smith/...` or `C:\Users\John Smith\...` — must be emitted as a quoted string
 * or `go` cannot parse the generated `go.work`. Normalize Windows separators to
 * `/` (the workspace convention) and then delegate to
 * {@link autoQuoteGoModToken}, which mirrors `modfile.AutoQuote`.
 *
 * Exported for unit tests.
 */
export function formatGoWorkPath(p: string): string {
  return autoQuoteGoModToken(p.replace(/\\/g, "/"));
}

/**
 * Quote `token` for a `go.mod`/`go.work` line exactly as
 * `golang.org/x/mod/modfile`'s `AutoQuote` does: return it unchanged when it is
 * already a clean bare token, otherwise return its Go double-quoted form so the
 * value round-trips through the modfile lexer. A space-free path is therefore
 * emitted byte-for-byte as before; only tokens that would otherwise
 * mis-tokenize are quoted.
 *
 * Exported for unit tests.
 */
export function autoQuoteGoModToken(token: string): string {
  return mustQuoteGoModToken(token) ? goQuoteString(token) : token;
}

// Mirror `modfile.MustQuote`: report whether `s` must be quoted to appear as a
// single token on a modfile line.
function mustQuoteGoModToken(s: string): boolean {
  for (const ch of s) {
    if (ch === " " || ch === '"' || ch === "'" || ch === "`") {
      return true;
    }
    if (
      ch === "(" ||
      ch === ")" ||
      ch === "[" ||
      ch === "]" ||
      ch === "{" ||
      ch === "}" ||
      ch === ","
    ) {
      // Go tests `len(s) > 1` (byte length): a lone bracket/comma is a legal
      // bare token, but one embedded in a longer token forces quoting.
      if (Buffer.byteLength(s, "utf8") > 1) {
        return true;
      }
      continue;
    }
    if (!isGoGraphic(ch)) {
      return true;
    }
  }
  return s === "" || s === "//" || s === "/*";
}

// Mirror `strconv.Quote`: wrap in double quotes, backslash-escape `"` and `\`,
// emit Go-printable runes verbatim (including the ASCII space and printable
// Unicode), and escape everything else with Go's `\a\b\f\n\r\t\v` / `\xNN` /
// `\uNNNN` / `\UNNNNNNNN` forms so the token round-trips through
// `strconv.Unquote` in the modfile lexer.
function goQuoteString(s: string): string {
  let out = '"';
  for (const ch of s) {
    if (ch === '"' || ch === "\\") {
      out += `\\${ch}`;
      continue;
    }
    if (isGoPrintable(ch)) {
      out += ch;
      continue;
    }
    out += escapeGoRune(ch);
  }
  return `${out}"`;
}

function escapeGoRune(ch: string): string {
  switch (ch) {
    case "\x07":
      return "\\a";
    case "\b":
      return "\\b";
    case "\f":
      return "\\f";
    case "\n":
      return "\\n";
    case "\r":
      return "\\r";
    case "\t":
      return "\\t";
    case "\v":
      return "\\v";
    default: {
      const cp = ch.codePointAt(0) ?? 0;
      if (cp < 0x20 || cp === 0x7f) {
        return `\\x${cp.toString(16).padStart(2, "0")}`;
      }
      if (cp < 0x10000) {
        return `\\u${cp.toString(16).padStart(4, "0")}`;
      }
      return `\\U${cp.toString(16).padStart(8, "0")}`;
    }
  }
}

// `unicode.IsGraphic`: categories L, M, N, P, S, Zs (all spacing).
const GO_GRAPHIC_RE = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}]$/u;

function isGoGraphic(ch: string): boolean {
  return GO_GRAPHIC_RE.test(ch);
}

// `strconv.IsPrint`: the graphic categories except that the ONLY spacing
// character is the ASCII space (U+0020); other Unicode spaces are escaped.
const GO_PRINTABLE_RE = /^[\p{L}\p{M}\p{N}\p{P}\p{S}]$/u;

function isGoPrintable(ch: string): boolean {
  return ch === " " || GO_PRINTABLE_RE.test(ch);
}

interface GoModReplacement {
  readonly modulePath: string;
}

interface GoModInfo {
  readonly modulePath: string | null;
  readonly replacements: readonly GoModReplacement[];
}

interface GoModReader {
  read(dir: string): GoModInfo;
}

interface GoModJson {
  readonly Module?: {
    readonly Path?: string;
  };
  readonly Require?: readonly {
    readonly Path?: string;
    readonly Version?: string;
  }[];
  readonly Replace?: readonly {
    readonly Old?: {
      readonly Path?: string;
      readonly Version?: string;
    };
    readonly New?: {
      readonly Path?: string;
      readonly Version?: string;
    };
  }[];
}

function createGoModReader(goBinary: string, pluginName: string): GoModReader {
  const cache = new Map<string, GoModInfo>();
  return {
    read(dir) {
      const resolved = path.resolve(dir);
      const cached = cache.get(resolved);
      if (cached !== undefined) {
        return cached;
      }
      const info = readGoModInfo(resolved, goBinary, pluginName);
      cache.set(resolved, info);
      return info;
    },
  };
}

function readGoModInfo(
  dir: string,
  goBinary: string,
  pluginName: string,
): GoModInfo {
  if (!fs.existsSync(path.join(dir, "go.mod"))) {
    return emptyGoModInfo();
  }

  const result = spawnGoTool(goBinary, ["mod", "edit", "-json"], {
    cwd: dir,
    encoding: "utf8",
    env: goBuildEnv(goBinary),
    maxBuffer: 1024 * 1024 * 16,
    windowsHide: true,
  });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(goToolchainNotFoundMessage(pluginName));
    }
    throw new Error(
      `ttsc: reading go.mod for plugin "${pluginName}" failed to spawn ${goBinary}: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `ttsc: reading go.mod for plugin "${pluginName}" failed:\n${result.stderr || result.stdout}`,
    );
  }

  let json: GoModJson;
  try {
    json = JSON.parse(result.stdout) as GoModJson;
  } catch (error) {
    throw new Error(
      `ttsc: reading go.mod for plugin "${pluginName}" returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    modulePath: json.Module?.Path ?? null,
    replacements: (json.Replace ?? [])
      .map(jsonReplacementToGoModReplacement)
      .filter((replacement) => replacement !== null),
  };
}

function emptyGoModInfo(): GoModInfo {
  return {
    modulePath: null,
    replacements: [],
  };
}

function jsonReplacementToGoModReplacement(
  replacement: NonNullable<GoModJson["Replace"]>[number],
): GoModReplacement | null {
  const modulePath = replacement.Old?.Path;
  if (modulePath === undefined) {
    return null;
  }
  return {
    modulePath,
  };
}

function collectOverlayModulePaths(
  dirs: readonly string[],
  goModReader: GoModReader,
): Set<string> {
  const out = new Set<string>();
  for (const dir of dirs) {
    const modulePath = goModReader.read(dir).modulePath;
    if (modulePath !== null) {
      out.add(modulePath);
    }
  }
  return out;
}

function isTtscManagedModulePath(modulePath: string): boolean {
  return (
    modulePath === TTSC_GO_MODULE_PATH ||
    modulePath === TSGO_GO_MODULE_PATH ||
    modulePath.startsWith("github.com/microsoft/typescript-go/shim/")
  );
}

function runGoBuild(
  cwd: string,
  entry: string,
  binaryName: string,
  pluginName: string,
  goBinary: string,
  goBuildCacheRoot: string,
): void {
  ensureExecutableGoToolchain(goBinary);
  const result = spawnGoTool(goBinary, ["build", "-o", binaryName, entry], {
    cwd,
    encoding: "utf8",
    env: goBuildEnv(goBinary, goBuildCacheRoot),
    maxBuffer: 1024 * 1024 * 64,
    windowsHide: true,
  });
  if (result.error) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(goToolchainNotFoundMessage(pluginName));
    }
    throw new Error(
      `ttsc: building plugin "${pluginName}" failed to spawn ${goBinary}: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `ttsc: building plugin "${pluginName}" via "go build" failed:\n${result.stderr || result.stdout}`,
    );
  }
}

function goToolchainNotFoundMessage(pluginName: string): string {
  return (
    `ttsc: building plugin "${pluginName}" failed because the Go toolchain was not found. ` +
    `Reinstall ttsc with optional dependencies so the bundled Go compiler is present, ` +
    `or set TTSC_GO_BINARY to an absolute path.`
  );
}

function spawnGoTool(
  goBinary: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string> {
  const shell = shouldSpawnGoToolThroughShell(goBinary);
  // Under shell:true (a Windows .cmd/.bat wrapper) Node does not quote the
  // command, so a wrapper at a path containing a space would be split by cmd.
  // Quote it here; the go arguments ttsc passes never contain spaces, and
  // quoting a space-free path is harmless.
  return spawnSync(shell ? `"${goBinary}"` : goBinary, [...args], {
    ...options,
    shell,
  });
}

function shouldSpawnGoToolThroughShell(goBinary: string): boolean {
  return process.platform === "win32" && /\.(?:bat|cmd)$/i.test(goBinary);
}

function goBuildEnv(
  goBinary: string,
  goBuildCacheRoot?: string,
): NodeJS.ProcessEnv {
  const env = { ...process.env };
  env.GOWORK = "auto";
  // Only the actual `go build` needs ttsc's GOCACHE; read-only metadata spawns
  // (`go mod edit`, `go env`, `go version`) call goBuildEnv with no cache root
  // and inherit the ambient GOCACHE, which they never write to anyway. GOCACHE
  // is not part of the plugin cache key, so this cannot affect it.
  if (goBuildCacheRoot) {
    env.GOCACHE = goBuildCacheRoot;
  }
  const goRoot = inferGoRoot(goBinary);
  if (goRoot && !env.GOROOT) {
    env.GOROOT = goRoot;
  }
  return env;
}

function inferGoRoot(goBinary: string): string | null {
  if (!path.isAbsolute(goBinary)) return null;
  const binDir = path.dirname(goBinary);
  if (path.basename(binDir) !== "bin") return null;
  const goRoot = path.dirname(binDir);
  return fs.existsSync(path.join(goRoot, "src", "runtime")) ? goRoot : null;
}

function ensureExecutableGoToolchain(goBinary: string): void {
  if (process.platform === "win32") return;
  if (!path.isAbsolute(goBinary) || !fs.existsSync(goBinary)) return;
  try {
    fs.chmodSync(goBinary, 0o755);
    const goRoot = inferGoRoot(goBinary);
    if (!goRoot) return;
    const gofmt = path.join(path.dirname(goBinary), "gofmt");
    if (fs.existsSync(gofmt)) fs.chmodSync(gofmt, 0o755);
    const toolDir = path.join(goRoot, "pkg", "tool");
    if (!fs.existsSync(toolDir)) return;
    for (const file of walkToolFiles(toolDir)) {
      fs.chmodSync(file, 0o755);
    }
  } catch {
    // Let the subsequent go build spawn fail with the real OS error.
  }
}

function walkToolFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkToolFiles(file));
    } else if (entry.isFile()) {
      out.push(file);
    }
  }
  return out;
}

function findTtscOverlayDirs(): readonly string[] {
  const ttscRoot = path.resolve(__dirname, "..", "..", "..");
  const dirs: string[] = [];
  if (fs.existsSync(path.join(ttscRoot, "go.mod"))) {
    dirs.push(ttscRoot);
  }
  const shimRoot = path.join(ttscRoot, "shim");
  if (fs.existsSync(shimRoot)) {
    walkForGoMod(shimRoot, dirs);
  }
  dirs.sort();
  return dirs;
}

function walkForGoMod(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  let hasGoMod = false;
  for (const entry of entries) {
    if (entry.isFile() && entry.name === "go.mod") {
      hasGoMod = true;
    }
  }
  if (hasGoMod) {
    out.push(dir);
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (shouldPruneDirectory(entry.name)) continue;
    walkForGoMod(path.join(dir, entry.name), out);
  }
}

/**
 * Resolve the directory where compiled plugin binaries are cached.
 *
 * Delegates to {@link resolveSourceBuildCachePaths}; kept as a thin accessor for
 * callers (and tests) that only need the plugin-binary root. Triggers the
 * opportunistic project-cache GC as a side effect for the default location.
 */
export function resolvePluginCacheRoot(
  projectRoot: string,
  cacheDir?: string,
): string {
  const paths = resolveSourceBuildCachePaths(projectRoot, cacheDir);
  maybePrunePluginCache(paths, cacheDir);
  return paths.pluginRoot;
}

/**
 * Resolve all source-plugin build cache directories for one invocation.
 *
 * `pluginRoot` stores compiled plugin binaries; `goBuildRoot` is the Go object
 * cache passed as `GOCACHE` while ttsc builds those binaries. Both live under a
 * single `root`, so persisting one directory covers the whole source-build
 * cache without depending on ttsc internals.
 */
export function resolveSourceBuildCachePaths(
  projectRoot: string,
  cacheDir?: string,
  env: NodeJS.ProcessEnv = process.env,
): ITtscSourceBuildCachePaths {
  const root = resolveSourceBuildCacheRoot(projectRoot, cacheDir, env);
  const goBuild = resolveGoBuildCacheRoot(root, projectRoot, env);
  return {
    root,
    pluginRoot: path.join(root, PLUGIN_CACHE_DIRNAME),
    goBuildRoot: goBuild.root,
    goBuildRootSource: goBuild.source,
  };
}

/**
 * Resolve the cache root for one invocation.
 *
 * Priority:
 *
 * 1. Explicit `cacheDir` option (resolved relative to `projectRoot`);
 * 2. `TTSC_CACHE_DIR` environment variable (resolved absolute);
 * 3. `<workspaceRoot>/node_modules/.cache/ttsc` — project-local by default.
 *
 * There is deliberately NO global (`~/.cache`) fallback: the cache is scoped to
 * the workspace so it can never accumulate machine-wide, and `rm -rf
 * node_modules` reclaims it.
 */
function resolveSourceBuildCacheRoot(
  projectRoot: string,
  cacheDir: string | undefined,
  env: NodeJS.ProcessEnv,
): string {
  if (cacheDir) {
    return path.resolve(projectRoot, cacheDir);
  }
  if (env.TTSC_CACHE_DIR) {
    // Anchor a relative TTSC_CACHE_DIR to the project root (not the process
    // cwd) so a programmatic host whose cwd differs from the project still
    // resolves — and later cleans — the same cache. Absolute values pass
    // through path.resolve unchanged.
    return path.resolve(projectRoot, env.TTSC_CACHE_DIR);
  }
  return path.join(
    resolveWorkspaceRoot(projectRoot),
    NODE_MODULES_DIRNAME,
    LOCAL_CACHE_PARENT_DIRNAME,
    TTSC_CACHE_DIRNAME,
  );
}

/**
 * Resolve the monorepo/workspace root for `projectRoot` so every package shares
 * one cache and a plugin builds once per workspace, not once per package.
 *
 * Walks up from `projectRoot` and returns, in order of preference: the NEAREST
 * ancestor that is a workspace root (holds `pnpm-workspace.yaml`, or a
 * `package.json` with a `workspaces` field); else the nearest ancestor that
 * already contains a `node_modules` directory; else `projectRoot` itself.
 *
 * Nearest (not highest) so an unrelated ancestor that happens to declare
 * `workspaces` — for example a `package.json` in the user's home directory —
 * cannot pull the cache above the project's real monorepo root.
 */
function resolveWorkspaceRoot(projectRoot: string): string {
  let dir = path.resolve(projectRoot);
  let nearestNodeModulesOwner: string | null = null;
  for (;;) {
    if (isWorkspaceRootDir(dir)) {
      return dir;
    }
    if (
      nearestNodeModulesOwner === null &&
      fs.existsSync(path.join(dir, NODE_MODULES_DIRNAME))
    ) {
      nearestNodeModulesOwner = dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return nearestNodeModulesOwner ?? path.resolve(projectRoot);
}

function isWorkspaceRootDir(dir: string): boolean {
  for (const marker of WORKSPACE_ROOT_MARKER_FILES) {
    if (fs.existsSync(path.join(dir, marker))) {
      return true;
    }
  }
  return packageJsonDeclaresWorkspaces(path.join(dir, "package.json"));
}

function packageJsonDeclaresWorkspaces(packageJsonPath: string): boolean {
  let text: string;
  try {
    text = fs.readFileSync(packageJsonPath, "utf8");
  } catch {
    return false;
  }
  try {
    const workspaces = (JSON.parse(text) as { workspaces?: unknown })
      .workspaces;
    // A real workspace root declares a NON-EMPTY package list (an array, or an
    // object with a `packages` array). Ignore `false`, `[]`, `null`, or `{}` so
    // a disabled or empty declaration on an unrelated ancestor cannot hijack
    // the cache location.
    if (Array.isArray(workspaces)) {
      return workspaces.length > 0;
    }
    if (workspaces !== null && typeof workspaces === "object") {
      const packages = (workspaces as { packages?: unknown }).packages;
      return Array.isArray(packages) && packages.length > 0;
    }
    return false;
  } catch {
    return false;
  }
}

function resolveGoBuildCacheRoot(
  root: string,
  projectRoot: string,
  env: NodeJS.ProcessEnv,
): {
  root: string;
  source: ITtscSourceBuildCachePaths["goBuildRootSource"];
} {
  if (env.TTSC_GO_CACHE_DIR) {
    // Anchor a relative TTSC_GO_CACHE_DIR to the project root, matching
    // TTSC_CACHE_DIR, so the build and a later `clean` from a different cwd
    // agree on the directory. Absolute values pass through unchanged.
    return {
      root: path.resolve(projectRoot, env.TTSC_GO_CACHE_DIR),
      source: "TTSC_GO_CACHE_DIR",
    };
  }
  if (env.GOCACHE && env.GOCACHE.length > 0) {
    return {
      root: env.GOCACHE,
      source: "GOCACHE",
    };
  }
  return {
    root: path.join(root, GO_BUILD_CACHE_DIRNAME),
    source: "ttsc-cache",
  };
}

function maybePrunePluginCache(
  paths: ITtscSourceBuildCachePaths,
  cacheDir?: string,
): void {
  // GC only the default (workspace-local) location. When the user pins an
  // explicit `cacheDir`/`TTSC_CACHE_DIR`, they own its lifetime, so ttsc must
  // not delete entries out from under them.
  if (!cacheDir && !process.env.TTSC_CACHE_DIR) {
    prunePluginCacheRoot(paths.pluginRoot);
  }
}

/**
 * Return every directory `ttsc clean` should remove for `projectRoot`.
 *
 * Covers the resolved cache root (which holds `plugins/` and, when ttsc-owned,
 * `go-build/`), a ttsc-owned Go build cache that lives OUTSIDE that root
 * (`TTSC_GO_CACHE_DIR`), and the two legacy project-local caches. A
 * user-provided `GOCACHE` is never removed. Pure over `env`, so the CLI passes
 * `process.env` and a programmatic caller can pass an injected environment.
 */
export function resolveCleanTargets(
  projectRoot: string,
  cacheDir?: string,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const paths = resolveSourceBuildCachePaths(projectRoot, cacheDir, env);
  // Remove ttsc-OWNED directories only, never the parent cache root.
  const targets = [paths.pluginRoot];
  // ttsc's nested `<root>/go-build` is only safe to delete when we are certain
  // the root belongs to ttsc: the default `node_modules/.cache/ttsc`, or a root
  // the user explicitly named `ttsc`. Under a shared root (e.g.
  // `TTSC_CACHE_DIR=~/.cache`) a bare `<root>/go-build` could be the user's
  // machine-wide GOCACHE, so it must never be removed by name.
  const isTtscOwnedRoot =
    (!cacheDir && !env.TTSC_CACHE_DIR) ||
    path.basename(paths.root) === TTSC_CACHE_DIRNAME;
  if (isTtscOwnedRoot) {
    targets.push(path.join(paths.root, GO_BUILD_CACHE_DIRNAME));
  }
  // An explicit TTSC_GO_CACHE_DIR is a ttsc-dedicated external cache; a
  // user-provided GOCACHE (source "GOCACHE") is never removed.
  if (paths.goBuildRootSource === "TTSC_GO_CACHE_DIR") {
    targets.push(paths.goBuildRoot);
  }
  targets.push(path.join(projectRoot, NODE_MODULES_DIRNAME, ".ttsc"));
  targets.push(path.join(projectRoot, ".ttsc"));
  return targets;
}

/**
 * Machine-global cache directories created by pre-0.17 ttsc releases (XDG /
 * AppData / Library / `~/.cache`). ttsc no longer writes to any of these, but
 * an upgraded machine can still hold a multi-GB orphaned cache here, so `ttsc
 * clean` offers them for removal to reclaim that disk. Each entry is the whole
 * `<userCacheRoot>/ttsc` directory (both its `plugins` and `go-build`), which
 * was entirely ttsc-owned in those releases and is safe to remove.
 */
export function legacyGlobalCacheTargets(): string[] {
  const roots = new Set<string>();
  const home = os.homedir();
  const xdg = process.env.XDG_CACHE_HOME;
  if (xdg && path.isAbsolute(xdg)) {
    roots.add(path.join(xdg, TTSC_CACHE_DIRNAME));
  }
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA;
    if (local && path.isAbsolute(local)) {
      roots.add(path.join(local, TTSC_CACHE_DIRNAME));
    }
    if (home) {
      roots.add(path.join(home, "AppData", "Local", TTSC_CACHE_DIRNAME));
    }
  } else if (process.platform === "darwin" && home) {
    roots.add(path.join(home, "Library", "Caches", TTSC_CACHE_DIRNAME));
  }
  if (home) {
    roots.add(path.join(home, ".cache", TTSC_CACHE_DIRNAME));
  }
  return [...roots];
}

/** Report whether `child` equals `parent` or is nested beneath it. */
export function isPathWithin(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return (
    rel === "" ||
    (rel !== ".." && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel))
  );
}

function resolveGoCompiler(): string {
  const explicit = process.env.TTSC_GO_BINARY;
  if (explicit && explicit.length > 0) return explicit;

  try {
    return createRequire(__filename).resolve(
      `@ttsc/${process.platform}-${process.arch}/bin/go/bin/${process.platform === "win32" ? "go.exe" : "go"}`,
    );
  } catch {
    /* fall through */
  }

  const platformPackage = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    `ttsc-${process.platform}-${process.arch}`,
    "bin",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(platformPackage)) return platformPackage;

  const local = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "native",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(local)) return local;

  const homeSdk = path.join(
    process.env.HOME ?? "",
    "go-sdk",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(homeSdk)) return homeSdk;

  return "go";
}

/**
 * Compute a deterministic SHA-256 cache key for a plugin build.
 *
 * The key covers every input that can produce a different binary: ttsc/tsgo
 * versions, platform, entry package, Go compiler identity, Go build environment
 * variables, overlay module sources, plugin source files, and contributor
 * source files. Contributors are sorted by name so declaration order does not
 * affect the key.
 *
 * Exposed for testing and for the `ttsc cache` CLI command.
 */
export function computeCacheKey(inputs: {
  contributors?: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  goBinary?: string;
  overlayDirs?: readonly string[];
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const hash = crypto.createHash("sha256");
  hash.update(`ttsc=${inputs.ttscVersion}\n`);
  hash.update(`tsgo=${inputs.tsgoVersion}\n`);
  hash.update(`platform=${process.platform}/${process.arch}\n`);
  hash.update(`entry=${inputs.entry}\n`);
  if (inputs.goBinary !== undefined) {
    hash.update(`go=${resolveGoCompilerIdentity(inputs.goBinary)}\n`);
  }
  hashGoBuildEnvironment(hash, inputs.goBinary, inputs.dir);
  hashExternalGoBuildEnvironment(hash);
  hashSourceDirectory(hash, "plugin", inputs.dir);
  for (const [index, dir] of [...(inputs.overlayDirs ?? [])].sort().entries()) {
    hashSourceDirectory(hash, `overlay:${index}`, dir);
  }
  // Hash contributors in sorted-by-name order so two consumers with the
  // same logical set produce the same key regardless of declaration order
  // in the host's plugin descriptor.
  const sortedContributors = [...(inputs.contributors ?? [])].sort((a, b) =>
    a.name === b.name ? 0 : a.name < b.name ? -1 : 1,
  );
  for (const contributor of sortedContributors) {
    hashSourceDirectory(
      hash,
      `contributor:${contributor.name}`,
      contributor.source,
    );
  }
  return hash.digest("hex").slice(0, 32);
}

function hashSourceDirectory(
  hash: crypto.Hash,
  label: string,
  root: string,
): void {
  hash.update(`dir=${label}\n`);
  for (const file of collectSourceFiles(root)) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    hash.update(`f=${rel}\n`);
    hash.update(fs.readFileSync(file));
    hash.update("\n");
  }
}

function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  walk(root, out);
  out.sort();
  return out;
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (shouldPruneDirectory(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (shouldOmitSourceFile(entry.name)) continue;
    if (!isHashableFile(entry.name)) continue;
    out.push(full);
  }
}

function shouldPruneDirectory(name: string): boolean {
  return PRUNE_DIRS.has(name);
}

function shouldOmitSourceFile(name: string): boolean {
  if (GENERATED_WORKSPACE_FILES.has(name)) return true;
  // npm-pack tarballs and macOS/Windows editor sidecars are local
  // build artifacts that drift independently of the Go source. They
  // would otherwise enter the cache key and bust the cached binary on
  // every unrelated `npm pack` or editor save.
  if (name.endsWith(".tgz") || name.endsWith(".tar.gz")) return true;
  if (name === ".DS_Store" || name === "Thumbs.db") return true;
  return false;
}

function isHashableFile(name: string): boolean {
  return !name.endsWith("~");
}

// Per-process memo for the Go compiler identity. `computeCacheKey` runs once
// per source plugin, so an N-plugin project that points every plugin at the
// same toolchain would otherwise pay N `go version` spawns plus N ~150MB
// binary hashes for a value that does not change between plugins. The result
// is a pure function of the go binary's resolved real path plus its on-disk
// content; the memo key therefore mixes the resolved real path with a cheap
// content signature (byte size + nanosecond mtime). That signature changes if
// a long-lived host rewrites the binary in place between calls, so the memo
// re-derives the identity exactly as the un-memoized code would and the
// cache-key bytes stay byte-for-byte identical to today. `go version` reads no
// cwd/custom env (the spawn passes neither), so cwd is not part of the key.
const goCompilerIdentityCache = new Map<string, string>();

function resolveGoCompilerIdentity(goBinary: string): string {
  const resolved = resolveExecutableIdentityPath(goBinary);
  const memoKey = goCompilerIdentityMemoKey(goBinary, resolved);
  if (memoKey !== null) {
    const cached = goCompilerIdentityCache.get(memoKey);
    if (cached !== undefined) {
      return cached;
    }
  }
  const identity = computeGoCompilerIdentity(goBinary, resolved);
  if (memoKey !== null) {
    goCompilerIdentityCache.set(memoKey, identity);
  }
  return identity;
}

// Build a memo key that pins both the resolved binary path and its current
// content. Returns null (skip caching, recompute) when the binary cannot be
// stat-ed, so the rare unstattable case never serves a stale identity.
function goCompilerIdentityMemoKey(
  goBinary: string,
  resolved: string,
): string | null {
  try {
    const stat = fs.statSync(resolved);
    return `${goBinary}\0${resolved}\0${stat.size}\0${stat.mtimeMs}`;
  } catch {
    return null;
  }
}

function computeGoCompilerIdentity(goBinary: string, resolved: string): string {
  if (!fs.existsSync(resolved)) {
    return "missing";
  }
  const version = spawnGoTool(goBinary, ["version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const versionText =
    version.error !== undefined
      ? ((version.error as NodeJS.ErrnoException).code ?? version.error.message)
      : `${version.status ?? 0}:${version.stdout}${version.stderr}`;
  const binaryHash = hashFile(resolved);
  return `sha256:${binaryHash}:${versionText}`;
}

function resolveExecutableIdentityPath(binary: string): string {
  if (path.isAbsolute(binary)) {
    return resolveRealPath(binary);
  }
  if (binary.includes(path.sep)) {
    return resolveRealPath(path.resolve(binary));
  }
  for (const dir of readPathEnvironment().split(path.delimiter)) {
    if (dir.length === 0) continue;
    const candidate = path.join(dir, binary);
    if (fs.existsSync(candidate)) {
      return resolveRealPath(candidate);
    }
    if (process.platform === "win32") {
      // Probe every PATHEXT extension, not just `.exe`, so a compiler backed by
      // a `.cmd`/`.bat` wrapper resolves to its real file and is hashed into the
      // cache key. Otherwise the wrapper reads as "missing" and a change to it
      // would not invalidate the cached plugin binary.
      for (const ext of windowsExecutableExtensions()) {
        const executable = `${candidate}${ext}`;
        if (fs.existsSync(executable)) {
          return resolveRealPath(executable);
        }
      }
    }
  }
  return binary;
}

function windowsExecutableExtensions(): readonly string[] {
  const pathext = process.env.PATHEXT;
  const raw = pathext && pathext.length > 0 ? pathext : ".COM;.EXE;.BAT;.CMD";
  return raw
    .split(";")
    .map((ext) => ext.trim().toLowerCase())
    .filter((ext) => ext.length > 0);
}

function readPathEnvironment(): string {
  return process.env.PATH ?? process.env.Path ?? "";
}

function resolveRealPath(location: string): string {
  try {
    return fs.realpathSync(location);
  } catch {
    return location;
  }
}

function hashFile(file: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(file));
  return hash.digest("hex");
}

function hashGoBuildEnvironment(
  hash: crypto.Hash,
  goBinary: string | undefined,
  cwd: string,
): void {
  const values = resolveGoBuildEnvironment(goBinary, cwd);
  for (const key of GO_BUILD_ENV_KEYS) {
    const value = values.get(key);
    if (value !== undefined && value !== "") {
      hash.update(`${key}=${value}\n`);
    }
  }
}

function resolveGoBuildEnvironment(
  goBinary: string | undefined,
  cwd: string,
): Map<string, string> {
  const values = new Map<string, string>();
  if (goBinary !== undefined) {
    const result = spawnGoTool(
      goBinary,
      ["env", "-json", ...GO_BUILD_ENV_KEYS],
      {
        cwd,
        encoding: "utf8",
        env: goBuildEnv(goBinary),
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
    );
    if (result.error === undefined && result.status === 0) {
      try {
        const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
        for (const key of GO_BUILD_ENV_KEYS) {
          const raw = parsed[key];
          if (typeof raw === "string" && raw !== "") {
            values.set(key, normalizeGoBuildEnvValue(key, raw));
          }
        }
      } catch {
        // Fall back to process.env below; a cache key is still better than
        // failing before `go build` can produce the actionable error.
      }
    }
  }
  for (const key of GO_BUILD_ENV_KEYS) {
    if (values.has(key)) continue;
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      values.set(key, normalizeGoBuildEnvValue(key, value));
    }
  }
  return values;
}

function normalizeGoBuildEnvValue(key: string, value: string): string {
  if (key === "GOROOT") {
    return resolveGoRootCacheIdentity(value);
  }
  if (GO_BUILD_COMMAND_ENV_KEYS.has(key)) {
    return `${value}\0${resolveCommandCacheIdentity(value)}`;
  }
  return value;
}

function resolveCommandCacheIdentity(command: string): string {
  const executable = firstCommandToken(command);
  if (executable === null) {
    return "command:empty";
  }
  const resolved = resolveExecutableIdentityPath(executable);
  if (!fs.existsSync(resolved)) {
    return `command:missing:${executable}`;
  }
  try {
    return `command:sha256:${hashFile(resolved)}`;
  } catch {
    return `command:unreadable:${resolved}`;
  }
}

function firstCommandToken(command: string): string | null {
  const trimmed = command.trim();
  if (trimmed === "") {
    return null;
  }
  const quote = trimmed[0];
  if (quote === "'" || quote === '"') {
    const end = trimmed.indexOf(quote, 1);
    return end === -1 ? trimmed.slice(1) : trimmed.slice(1, end);
  }
  return trimmed.split(/\s+/)[0] ?? null;
}

function hashExternalGoBuildEnvironment(hash: crypto.Hash): void {
  for (const key of EXTERNAL_GO_BUILD_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined && value !== "") {
      hash.update(`${key}=${value}\n`);
    }
  }
}

function resolveGoRootCacheIdentity(goRoot: string): string {
  const resolved = resolveRealPath(goRoot);
  if (!fs.existsSync(resolved)) {
    return `missing:${goRoot}`;
  }
  const hash = crypto.createHash("sha256");
  for (const file of collectGoRootIdentityFiles(resolved)) {
    const relative = path.relative(resolved, file).replace(/\\/g, "/");
    hash.update(`f=${relative}\n`);
    hash.update(fs.readFileSync(file));
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}

function collectGoRootIdentityFiles(root: string): string[] {
  const out: string[] = [];
  walkGoRootIdentity(root, root, out);
  out.sort();
  return out;
}

function walkGoRootIdentity(root: string, dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (shouldHashGoRootPath(rel, true)) {
        walkGoRootIdentity(root, file, out);
      }
    } else if (entry.isFile() && shouldHashGoRootPath(rel, false)) {
      out.push(file);
    }
  }
}

function shouldHashGoRootPath(rel: string, isDir: boolean): boolean {
  if (rel === "") return true;
  const parts = rel.split("/");
  if (parts.includes(".git") || parts.includes("testdata")) return false;
  if (!isDir && rel.endsWith("_test.go")) return false;

  const first = parts[0]!;
  if (parts.length === 1) {
    if (isDir) return ["bin", "pkg", "src", "lib"].includes(first);
    return ["VERSION", "go.env"].includes(first);
  }
  if (first === "bin") {
    if (isDir) return true;
    const base = path.basename(rel);
    return (
      base === "go" ||
      base === "go.exe" ||
      base === "gofmt" ||
      base === "gofmt.exe"
    );
  }
  if (first === "pkg") {
    const second = parts[1]!;
    return second === "tool" || second === "include";
  }
  if (first === "src") {
    if (!isDir && parts.length === 2) {
      return ["go.mod", "go.sum"].includes(parts[1]!);
    }
    return parts[1] !== "cmd";
  }
  if (first === "lib") {
    return parts[1] === "time";
  }
  return false;
}

function touchCacheEntry(cacheDir: string): void {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(
      path.join(cacheDir, CACHE_LAST_USED_FILE),
      `${Date.now()}\n`,
    );
  } catch {
    // Cache hits must not fail because metadata touch failed.
  }
}

function prunePluginCacheRoot(root: string): void {
  try {
    fs.mkdirSync(root, { recursive: true });
    const marker = path.join(root, CACHE_GC_MARKER_FILE);
    const now = Date.now();
    const lastRun = readTimestamp(marker);
    if (lastRun !== null && now - lastRun < PLUGIN_CACHE_GC_INTERVAL_MS) {
      return;
    }
    fs.writeFileSync(marker, `${now}\n`);
    prunePluginCacheEntries(root, now);
  } catch {
    // Plugin-cache GC is opportunistic; builds still proceed when it fails.
  }
}

function prunePluginCacheEntries(root: string, now: number): void {
  const entries = collectPluginCacheEntries(root, now);
  for (const entry of entries) {
    if (now - entry.lastUsedAt <= PLUGIN_CACHE_ENTRY_MAX_AGE_MS) {
      continue;
    }
    removeCacheEntry(entry);
  }

  const remaining = collectPluginCacheEntries(root, now);
  let total = remaining.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= PLUGIN_CACHE_MAX_BYTES) {
    return;
  }
  for (const entry of remaining.sort((a, b) => a.lastUsedAt - b.lastUsedAt)) {
    if (total <= PLUGIN_CACHE_TARGET_BYTES) {
      return;
    }
    if (now - entry.lastUsedAt <= PLUGIN_CACHE_PROTECTED_AGE_MS) {
      continue;
    }
    removeCacheEntry(entry);
    total -= entry.size;
  }
}

interface PluginCacheEntry {
  dir: string;
  lastUsedAt: number;
  size: number;
}

function collectPluginCacheEntries(
  root: string,
  now: number,
): PluginCacheEntry[] {
  const entries: PluginCacheEntry[] = [];
  let dirents: fs.Dirent[];
  try {
    dirents = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return entries;
  }
  for (const dirent of dirents) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const dir = path.join(root, dirent.name);
    const lastUsedAt = readCacheEntryLastUsedAt(dir, now);
    entries.push({
      dir,
      lastUsedAt,
      size: directorySize(dir),
    });
  }
  return entries;
}

function readCacheEntryLastUsedAt(dir: string, now: number): number {
  const touched = readTimestamp(path.join(dir, CACHE_LAST_USED_FILE));
  if (touched !== null) {
    return touched;
  }
  for (const name of ["plugin", "plugin.exe"]) {
    try {
      return fs.statSync(path.join(dir, name)).mtimeMs;
    } catch {}
  }
  try {
    return fs.statSync(dir).mtimeMs;
  } catch {
    return now;
  }
}

function readTimestamp(file: string): number | null {
  try {
    const text = fs.readFileSync(file, "utf8").trim();
    const value = Number(text);
    if (Number.isFinite(value)) {
      return value;
    }
  } catch {}
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

function directorySize(dir: string): number {
  let total = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return total;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        total += directorySize(file);
      } else if (entry.isFile()) {
        total += fs.statSync(file).size;
      }
    } catch {}
  }
  return total;
}

function removeCacheEntry(entry: PluginCacheEntry): void {
  try {
    fs.rmSync(entry.dir, { recursive: true, force: true });
  } catch {
    // Windows may reject removal while a plugin binary is still running.
  }
}
