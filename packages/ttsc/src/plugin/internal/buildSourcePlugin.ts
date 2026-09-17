import {
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
  type StdioOptions,
  spawn,
  spawnSync,
} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

import { captureProcessOutput } from "../../compiler/internal/captureProcessOutput";
import { findNearestGoMod } from "../../compiler/internal/paths";
import { createCanonicalTempDirectory } from "../../internal/createCanonicalTempDirectory";
import { spawnSyncResilient } from "../../internal/spawnSyncResilient";

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
const PLUGIN_BUILD_LOCK_PROTOCOL_FILE = "protocol-v2";
const PLUGIN_BUILD_LOCK_GENERATION_FILE = "generation";
const PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR = "legacy-generation";
const PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD = "fence.json";
const PLUGIN_BUILD_LOCK_CURRENT_DIR = "current";
const PLUGIN_BUILD_LOCK_RETIRED_DIR = "retired";
const PLUGIN_BUILD_LOCK_V2_SUFFIX = ".v2";
const PLUGIN_BUILD_LOCK_PROTOCOL = "ttsc-plugin-build-lock-v2\n";
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

// Go's own object-cache trim is age-based and has no size ceiling. The default
// ttsc-owned cache therefore keeps up to 8 GiB and trims oldest objects toward
// 6 GiB. The newest target-sized set used within an hour remains protected so
// crossing the ceiling cannot immediately force another cold build.
const GO_BUILD_CACHE_GC_INTERVAL_MS = 24 * 60 * 60 * 1000;
const GO_BUILD_CACHE_MAX_BYTES = 8 * 1024 * 1024 * 1024;
const GO_BUILD_CACHE_TARGET_BYTES = 6 * 1024 * 1024 * 1024;
const GO_BUILD_CACHE_PROTECTED_AGE_MS = 60 * 60 * 1000;
const GO_BUILD_CACHE_GC_MARKER_FILE = ".ttsc-gc";
const GO_BUILD_CACHE_LEASE_DIR = ".ttsc-build-leases";
const GO_BUILD_CACHE_MAINTENANCE_DIR = ".ttsc-maintenance";
const GO_BUILD_CACHE_COORDINATION_STALE_MS = 60 * 60 * 1000;
const GO_BUILD_CACHE_MAINTENANCE_STALE_MS = 60 * 1000;
const GO_BUILD_CACHE_COORDINATION_CLOCK_SKEW_MS = 5 * 60 * 1000;
const GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS = 5_000;
const GO_BUILD_CACHE_COORDINATION_POLL_MS = 25;
// Go amortizes cache-hit mtime writes over one hour. An object used inside
// ttsc's one-hour protection window may therefore still carry an mtime almost
// one additional hour old.
const GO_BUILD_CACHE_ACCESS_MTIME_GRANULARITY_MS = 60 * 60 * 1000;

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

/** Synchronous filesystem reads used to fingerprint external Go toolchains. */
export interface SourceBuildFilesystemOperations {
  readFile(location: string): Buffer;
}

const DEFAULT_SOURCE_BUILD_FILESYSTEM: SourceBuildFilesystemOperations =
  Object.freeze({
    readFile: (location: string) => fs.readFileSync(location),
  });

/**
 * Build one Go source plugin into a cached executable.
 *
 * `opts.env` is the effective environment for this build — the caller merges `{
 * ...process.env, ...context.env }` so a programmatic `TtscCompiler` instance
 * can pin its own Go toolchain (`TTSC_GO_BINARY`), Go build cache
 * (`TTSC_GO_CACHE_DIR`), and Go build variables (`GOFLAGS`, `CGO_*`, …) without
 * mutating the shared `process.env`. CLI callers omit it and inherit
 * `process.env`, so ambient behavior is unchanged.
 */
export function buildSourcePlugin(opts: {
  source: string;
  pluginName: string;
  baseDir: string;
  cacheDir?: string;
  contributors?: readonly ITtscBuildContributor[];
  env?: NodeJS.ProcessEnv;
  filesystem?: Partial<SourceBuildFilesystemOperations>;
  label?: string;
  overlayDirs?: readonly string[];
  quiet?: boolean;
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const env = opts.env ?? process.env;
  const { dir, entry, source } = resolveSourceBuildTarget(opts);
  const overlayDirs = [...(opts.overlayDirs ?? findTtscOverlayDirs())].sort();
  const contributors = opts.contributors ?? [];
  const compiler = resolveGoCompiler(env);
  const goBinary = resolveGoToolForBuild(compiler.binary, env, dir);
  ensureExecutableGoToolchain(goBinary, compiler.bundled);
  const key = computeCacheKey({
    contributors,
    dir,
    entry,
    env,
    filesystem: opts.filesystem,
    goBinary,
    overlayDirs,
    ttscVersion: opts.ttscVersion,
    tsgoVersion: opts.tsgoVersion,
  });
  const paths = resolveSourceBuildCachePaths(opts.baseDir, opts.cacheDir, env);
  const managePluginCache = !opts.cacheDir && !env.TTSC_CACHE_DIR;
  const manageGoBuildCache = shouldManageSourceBuildCaches(
    paths,
    opts.cacheDir,
    env,
  );
  const pluginRoot = managePluginCache
    ? canonicalPluginCacheRoot(paths.pluginRoot)
    : paths.pluginRoot;
  maybePruneSourceBuildCaches({ ...paths, pluginRoot }, opts.cacheDir, env);
  const cacheDir = managePluginCache
    ? canonicalPluginCacheEntry(pluginRoot, key)
    : path.join(pluginRoot, key);
  const binaryName = process.platform === "win32" ? "plugin.exe" : "plugin";
  const binaryPath = path.join(cacheDir, binaryName);
  if (fs.existsSync(binaryPath)) {
    touchCacheEntry(cacheDir);
    return binaryPath;
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const label = opts.label ?? "source plugin";
  const quiet = opts.quiet === true;
  const built = buildUnderPluginLock(
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
        env,
        goBinary,
        normalizeGoToolPermissions: compiler.bundled,
        key,
        label,
        goBuildCacheRoot: paths.goBuildRoot,
        manageGoBuildCache,
        overlayDirs,
        pluginName: opts.pluginName,
        quiet,
        source,
      }),
  );
  if (managePluginCache) {
    // The pre-build daily pass cannot account for the binary this cold build
    // just published. Enforce the size policy after publication, once this
    // process has released its per-key build lock.
    prunePluginCacheRoot(pluginRoot, {
      force: true,
      protectedEntries: [cacheDir],
    });
  }
  return built;
}

/** Run the actual `go build` and publish the binary; assumes the lock is held. */
function compileSourcePlugin(opts: {
  binaryPath: string;
  cacheDir: string;
  contributors: readonly ITtscBuildContributor[];
  dir: string;
  entry: string;
  env: NodeJS.ProcessEnv;
  goBinary: string;
  goBuildCacheRoot: string;
  manageGoBuildCache: boolean;
  normalizeGoToolPermissions: boolean;
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
        `(this runs once per cache key and can take several minutes on a cold Go cache) ` +
        `See https://ttsc.dev/docs/ttsc/compile#plugin-cache to persist it across builds.\n`,
    );
  }

  const scratchDir = createCanonicalTempDirectory(`ttsc-plugin-${opts.key}-`);
  try {
    materializeScratchDir(opts.dir, scratchDir);
    const goModReader = createGoModReader(
      opts.goBinary,
      opts.pluginName,
      opts.env,
    );
    if (opts.contributors.length > 0) {
      mergeContributors({
        contributors: opts.contributors,
        entry: opts.entry,
        goModReader,
        pluginName: opts.pluginName,
        scratchDir,
      });
    }
    writeGoWork(
      scratchDir,
      opts.overlayDirs,
      opts.goBinary,
      opts.pluginName,
      opts.env,
    );
    const scratchBinaryName =
      process.platform === "win32" ? ".ttsc-plugin.exe" : ".ttsc-plugin";
    let attemptedGoBuildCacheRoot: string | undefined;
    try {
      withGoBuildCacheLease(
        opts.goBuildCacheRoot,
        opts.manageGoBuildCache,
        (goBuildCacheRoot) => {
          attemptedGoBuildCacheRoot = goBuildCacheRoot;
          runGoBuild(
            scratchDir,
            opts.entry,
            scratchBinaryName,
            opts.pluginName,
            opts.goBinary,
            goBuildCacheRoot,
            opts.env,
            opts.normalizeGoToolPermissions,
          );
        },
      );
    } finally {
      if (opts.manageGoBuildCache && attemptedGoBuildCacheRoot !== undefined) {
        // The daily pre-build pass cannot see objects the build is about to
        // add, including objects left behind by a failed compile. Enforce the
        // size policy after every actual cold-build attempt so churn cannot
        // grow the cache unchecked behind a fresh daily marker.
        pruneGoBuildCacheRoot(attemptedGoBuildCacheRoot, { force: true });
      }
    }
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
 * `<cacheDir>.lock.v2` is a persistent coordination directory. The adjacent
 * `<cacheDir>.lock` path remains reserved for legacy holders and is never
 * reused for a v2 generation: an old holder or stale legacy reclaimer can
 * therefore remove only the legacy path, never a v2 successor. A contender
 * writes a non-empty candidate and atomically renames it to `current`; only one
 * rename wins. The winner builds and publishes while every loser polls and
 * reuses the resulting binary. A loser distinguishes two ways a generation
 * stops blocking:
 *
 * - `released`: the holder retired `current` itself — it published, or its build
 *   threw and its `finally` freed the key. The loser simply retries the
 *   ordinary acquisition; nothing is stale and nothing is reported.
 * - `abandoned`: `current` still exists but its owner is provably dead, it is an
 *   old metadata-less legacy lock, or the wait budget
 *   (`PLUGIN_BUILD_LOCK_STEAL_MS`) expired. Only then does the loser report and
 *   retire precisely that generation before retrying.
 *
 * Retired generations remain as non-empty tombstones. Release and reclaim both
 * rename `current` to the observed generation's deterministic tombstone path.
 * Once generation A is retired, a stale observer or old finalizer for A cannot
 * rename successor B there because replacing the non-empty tombstone fails
 * atomically. `publishBuiltBinary`'s atomic rename remains defense in depth.
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
    let lease: PluginBuildLockLease | null;
    try {
      lease = acquirePluginBuildLock(lockDir);
    } catch {
      // An unusable coordination directory must not silently skip the build.
      // Atomic publication still preserves binary integrity.
      return build();
    }
    if (lease === null) {
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
        // Retire only the generation that produced this observation. Losing
        // the rename race means another waiter (or the holder's normal
        // finalizer) already made progress, so do not report a stale result as
        // an abandonment.
        if (reclaimPluginBuildLock(lockDir, waited.fence)) {
          reportPluginLockSteal(lockDir, binaryPath, lockInfo, waited.reason);
        }
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
      releasePluginBuildLock(lockDir, lease);
    }
  }
}

/** Opaque identity of one observed lock generation. */
export type PluginBuildLockFence = {
  protocol: "legacy" | "v2";
  generation: string;
};

/** Ownership token returned only to the process that acquired `current`. */
export type PluginBuildLockLease = {
  protocol: "v2";
  generation: string;
};

/**
 * Atomically acquire the current generation in a v2 coordination directory.
 *
 * A non-empty candidate is renamed to `current`. Directory rename cannot
 * replace a non-empty `current`, so exactly one contender wins without an
 * empty-owner publication window. `null` means either another v2 holder won or
 * the path is a legacy lock that must be observed before it can be reclaimed.
 *
 * Exported for deterministic multi-process tests.
 */
export function acquirePluginBuildLock(
  lockDir: string,
): PluginBuildLockLease | null {
  // A legacy holder owns the old path. Never publish v2 ownership into that
  // deletable namespace; wait until the legacy generation is released or
  // reclaimed, then use the orthogonal persistent v2 directory.
  if (pluginBuildLockPathExists(lockDir)) {
    return null;
  }
  const protocolDir = pluginBuildLockProtocolDir(lockDir);
  ensurePluginBuildLockProtocol(protocolDir);
  // Close the initialization window as far as the legacy protocol permits. A
  // legacy holder that appeared while v2 was initialized still blocks this
  // acquisition. (A legacy executable cannot provide a true cross-path CAS.)
  if (pluginBuildLockPathExists(lockDir)) {
    return null;
  }

  const generation = crypto.randomBytes(16).toString("hex");
  const candidateDir = path.join(protocolDir, `candidate-${generation}`);
  fs.mkdirSync(candidateDir);
  try {
    fs.writeFileSync(
      path.join(candidateDir, PLUGIN_BUILD_LOCK_GENERATION_FILE),
      `${generation}\n`,
      { encoding: "utf8", flag: "wx" },
    );
    writePluginBuildLockOwner(candidateDir, generation);
    try {
      fs.renameSync(
        candidateDir,
        path.join(protocolDir, PLUGIN_BUILD_LOCK_CURRENT_DIR),
      );
    } catch (error) {
      if (
        isMissingPathError(error) ||
        isRenameDestinationOccupied(
          error,
          path.join(protocolDir, PLUGIN_BUILD_LOCK_CURRENT_DIR),
        )
      ) {
        return null;
      }
      throw error;
    }
    return { protocol: "v2", generation };
  } finally {
    // The candidate name contains this process's random generation and can
    // never alias `current` or another contender's candidate.
    fs.rmSync(candidateDir, { force: true, recursive: true });
  }
}

/** Retire a held generation during the holder's `finally`. */
export function releasePluginBuildLock(
  lockDir: string,
  lease: PluginBuildLockLease,
): boolean {
  return retireV2PluginBuildLock(
    pluginBuildLockProtocolDir(lockDir),
    lease.generation,
  );
}

/**
 * Retire exactly the generation carried by an abandoned observation.
 *
 * Exported for deterministic multi-process tests.
 */
export function reclaimPluginBuildLock(
  lockDir: string,
  fence: PluginBuildLockFence,
): boolean {
  if (fence.protocol === "v2") {
    return retireV2PluginBuildLock(
      pluginBuildLockProtocolDir(lockDir),
      fence.generation,
    );
  }
  return retireLegacyPluginBuildLock(lockDir, fence.generation);
}

function pluginBuildLockProtocolDir(lockDir: string): string {
  return `${lockDir}${PLUGIN_BUILD_LOCK_V2_SUFFIX}`;
}

function ensurePluginBuildLockProtocol(protocolDir: string): void {
  if (isPluginBuildLockProtocolV2(protocolDir)) {
    return;
  }

  const generation = crypto.randomBytes(16).toString("hex");
  const candidateDir = `${protocolDir}.candidate-${generation}`;
  fs.mkdirSync(candidateDir);
  try {
    fs.mkdirSync(path.join(candidateDir, PLUGIN_BUILD_LOCK_RETIRED_DIR));
    fs.writeFileSync(
      path.join(candidateDir, PLUGIN_BUILD_LOCK_PROTOCOL_FILE),
      PLUGIN_BUILD_LOCK_PROTOCOL,
      { encoding: "utf8", flag: "wx" },
    );
    try {
      fs.renameSync(candidateDir, protocolDir);
    } catch (error) {
      if (
        isRenameDestinationOccupied(error, protocolDir) &&
        isPluginBuildLockProtocolV2(protocolDir)
      ) {
        return;
      }
      throw error;
    }
  } finally {
    fs.rmSync(candidateDir, { force: true, recursive: true });
  }
}

function isPluginBuildLockProtocolV2(lockDir: string): boolean {
  try {
    const stats = fs.lstatSync(lockDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) return false;
    return (
      fs.readFileSync(
        path.join(lockDir, PLUGIN_BUILD_LOCK_PROTOCOL_FILE),
        "utf8",
      ) === PLUGIN_BUILD_LOCK_PROTOCOL
    );
  } catch {
    return false;
  }
}

function retireV2PluginBuildLock(lockDir: string, generation: string): boolean {
  if (!isPluginBuildLockGeneration(generation)) return false;
  const retiredDir = path.join(lockDir, PLUGIN_BUILD_LOCK_RETIRED_DIR);
  try {
    fs.mkdirSync(retiredDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      if (isMissingPathError(error)) return false;
      throw error;
    }
  }

  const destination = path.join(retiredDir, generation);
  try {
    fs.renameSync(
      path.join(lockDir, PLUGIN_BUILD_LOCK_CURRENT_DIR),
      destination,
    );
    return true;
  } catch (error) {
    if (
      isMissingPathError(error) ||
      isRenameDestinationOccupied(error, destination)
    ) {
      return false;
    }
    throw error;
  }
}

function retireLegacyPluginBuildLock(
  lockDir: string,
  generation: string,
): boolean {
  if (!isPluginBuildLockGeneration(generation)) return false;
  const captured = readLegacyPluginBuildLockFence(
    path.join(lockDir, PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR),
  );
  if (captured?.fence.generation !== generation) {
    return false;
  }
  const destination = `${lockDir}.retired-${generation}`;
  try {
    fs.renameSync(lockDir, destination);
    return true;
  } catch (error) {
    if (
      isMissingPathError(error) ||
      isRenameDestinationOccupied(error, destination)
    ) {
      return false;
    }
    throw error;
  }
}

function isMissingPathError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "ENOENT" || code === "ENOTDIR";
}

function isRenameDestinationOccupied(
  error: unknown,
  destination: string,
): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EEXIST" || code === "ENOTEMPTY") {
    return true;
  }
  return (code === "EACCES" || code === "EPERM") && fs.existsSync(destination);
}

/**
 * Outcome of one waiting session on another process's plugin build lock.
 *
 * - `published`: the binary exists and can be reused.
 * - `released`: the observed generation no longer exists and no binary appeared —
 *   the holder freed the key normally, so the caller should retry ordinary
 *   acquisition without reporting or removing anything.
 * - `abandoned`: the lock still exists but is provably stale (dead owner, old
 *   legacy lock) or the wait budget expired; the caller may report and retire
 *   precisely the attached generation.
 *
 * Exported for unit tests.
 */
export type PluginBinaryWaitResult =
  | { outcome: "published" }
  | { outcome: "released" }
  | {
      outcome: "abandoned";
      reason: string;
      fence: PluginBuildLockFence;
    };

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
      // The holder retired its generation between the binary check above and
      // this observation. That is a normal release, not abandonment: prefer the
      // binary when it landed inside that window, otherwise hand the free key
      // back to the caller.
      return fs.existsSync(opts.binaryPath)
        ? { outcome: "published" }
        : { outcome: "released" };
    }
    if (lock.state === "abandoned") {
      return {
        outcome: "abandoned",
        reason: lock.reason,
        fence: lock.fence,
      };
    }
    if (now - startedAt > opts.timeoutMs) {
      return {
        outcome: "abandoned",
        reason: `timed out after ${formatDuration(now - startedAt)}`,
        fence: lock.fence,
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

function writePluginBuildLockOwner(
  generationDir: string,
  generation: string,
): void {
  fs.writeFileSync(
    path.join(generationDir, PLUGIN_BUILD_LOCK_OWNER_FILE),
    `${JSON.stringify(
      {
        generation,
        hostname: os.hostname(),
        pid: process.pid,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

/**
 * One observation of a plugin build lock directory's state.
 *
 * - `active`: the lock exists and its owner is alive (or cannot be disproven:
 *   another host, no metadata but young). Keep waiting.
 * - `abandoned`: the lock still exists and the evidence says nobody will ever
 *   release it — a same-host owner that is no longer running, or an old
 *   metadata-less legacy lock. Retiring its fenced generation is justified.
 * - `released`: the observed generation no longer exists. In v2 the persistent
 *   coordination root remains while `current` is absent. This is a routine
 *   handoff, never an infinitely old abandoned lock (issue #421).
 *
 * Exported for unit tests.
 */
export type PluginBuildLockObservation =
  | {
      state: "active";
      owner: string;
      fence: PluginBuildLockFence;
    }
  | {
      state: "abandoned";
      reason: string;
      fence: PluginBuildLockFence;
    }
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
  const protocolDir = pluginBuildLockProtocolDir(lockDir);
  for (;;) {
    if (isPluginBuildLockProtocolV2(protocolDir)) {
      const v2 = inspectV2PluginBuildLock(protocolDir, now);
      if (v2.state !== "released") {
        return v2;
      }
    }
    const legacy = captureLegacyPluginBuildLockFence(lockDir);
    if (legacy !== null) {
      return inspectLegacyPluginBuildLock(lockDir, now, legacy);
    }
    if (pluginBuildLockAgeMs(lockDir, now) === null) {
      return { state: "released" };
    }
    // The path changed while its legacy fence was being captured. Re-observe
    // the replacement rather than attaching the old state to a new owner.
  }
}

function inspectV2PluginBuildLock(
  lockDir: string,
  now: number,
): PluginBuildLockObservation {
  const generationDir = path.join(lockDir, PLUGIN_BUILD_LOCK_CURRENT_DIR);
  const generation = readPluginBuildLockGeneration(generationDir);
  if (generation === null) {
    if (pluginBuildLockAgeMs(generationDir, now) === null) {
      return { state: "released" };
    }
    throw new Error(
      `ttsc plugin build lock has no valid ${PLUGIN_BUILD_LOCK_GENERATION_FILE}: ${generationDir}`,
    );
  }
  const fence: PluginBuildLockFence = { protocol: "v2", generation };
  const owner = readPluginBuildLockOwner(generationDir);
  if (owner !== null) {
    const label = describePluginBuildLockOwner(owner);
    if (isLocalHostName(owner.hostname) && !isProcessAlive(owner.pid)) {
      return {
        state: "abandoned",
        reason: `${label} is no longer running`,
        fence,
      };
    }
    return {
      state: "active",
      owner: label,
      fence,
    };
  }

  const ageMs = pluginBuildLockAgeMs(generationDir, now);
  if (ageMs === null) {
    return { state: "released" };
  }
  if (ageMs > PLUGIN_BUILD_LOCK_LEGACY_STALE_MS) {
    return {
      state: "abandoned",
      reason:
        `lock generation has no ${PLUGIN_BUILD_LOCK_OWNER_FILE} and is ` +
        `${formatDuration(ageMs)} old`,
      fence,
    };
  }
  return {
    state: "active",
    owner: `lock generation with no ${PLUGIN_BUILD_LOCK_OWNER_FILE}`,
    fence,
  };
}

interface LegacyPluginBuildLockFence {
  fence: PluginBuildLockFence;
  legacyMtimeMs: number;
}

function inspectLegacyPluginBuildLock(
  lockDir: string,
  now: number,
  legacy: LegacyPluginBuildLockFence,
): PluginBuildLockObservation {
  const owner = readPluginBuildLockOwner(lockDir);
  if (owner !== null) {
    const label = describePluginBuildLockOwner(owner);
    if (isLocalHostName(owner.hostname) && !isProcessAlive(owner.pid)) {
      return {
        state: "abandoned",
        reason: `${label} is no longer running`,
        fence: legacy.fence,
      };
    }
    return {
      state: "active",
      owner: label,
      fence: legacy.fence,
    };
  }

  const ageMs = Math.max(0, now - legacy.legacyMtimeMs);
  if (ageMs > PLUGIN_BUILD_LOCK_LEGACY_STALE_MS) {
    return {
      state: "abandoned",
      reason:
        `legacy lock has no ${PLUGIN_BUILD_LOCK_OWNER_FILE} and is ` +
        `${formatDuration(ageMs)} old`,
      fence: legacy.fence,
    };
  }
  return {
    state: "active",
    owner: `legacy lock with no ${PLUGIN_BUILD_LOCK_OWNER_FILE}`,
    fence: legacy.fence,
  };
}

function captureLegacyPluginBuildLockFence(
  lockDir: string,
): LegacyPluginBuildLockFence | null {
  if (isPluginBuildLockProtocolV2(lockDir)) {
    return null;
  }

  let legacyMtimeMs: number;
  try {
    legacyMtimeMs = fs.statSync(lockDir).mtimeMs;
  } catch (error) {
    if (isMissingPathError(error)) return null;
    throw error;
  }

  const fenceDir = path.join(lockDir, PLUGIN_BUILD_LOCK_LEGACY_FENCE_DIR);
  let captured = readLegacyPluginBuildLockFence(fenceDir);
  if (captured === null) {
    const generation = crypto.randomBytes(16).toString("hex");
    // Keep candidates beside the legacy lock. Creating one inside `lockDir`
    // would advance its mtime before a contender publishes the shared fence;
    // a concurrent contender could then record an old lock as freshly created.
    const candidateDir = `${lockDir}.legacy-candidate-${generation}`;
    try {
      fs.mkdirSync(candidateDir);
      fs.writeFileSync(
        path.join(candidateDir, PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD),
        `${JSON.stringify({ generation, legacyMtimeMs })}\n`,
        "utf8",
      );
      try {
        fs.renameSync(candidateDir, fenceDir);
        captured = {
          fence: { protocol: "legacy", generation },
          legacyMtimeMs,
        };
      } catch (error) {
        if (isRenameDestinationOccupied(error, fenceDir)) {
          captured = readLegacyPluginBuildLockFence(fenceDir);
        } else if (isMissingPathError(error)) {
          return null;
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (isMissingPathError(error)) {
        return null;
      }
      throw error;
    } finally {
      fs.rmSync(candidateDir, { force: true, recursive: true });
    }
  }
  if (captured === null) {
    throw new Error(`invalid legacy plugin build lock fence: ${fenceDir}`);
  }

  // A stale observer can resume after the legacy holder released or another
  // process retired the path. Confirm both the legacy layout and token after
  // publication; v2 ownership is kept in the orthogonal sibling directory.
  const confirmed = readLegacyPluginBuildLockFence(fenceDir);
  if (
    isPluginBuildLockProtocolV2(lockDir) ||
    confirmed === null ||
    confirmed.fence.generation !== captured.fence.generation
  ) {
    return null;
  }
  return captured;
}

function readLegacyPluginBuildLockFence(
  fenceDir: string,
): LegacyPluginBuildLockFence | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(
        path.join(fenceDir, PLUGIN_BUILD_LOCK_LEGACY_FENCE_RECORD),
        "utf8",
      ),
    ) as Record<string, unknown>;
    if (
      !isPluginBuildLockGeneration(parsed.generation) ||
      typeof parsed.legacyMtimeMs !== "number" ||
      !Number.isFinite(parsed.legacyMtimeMs) ||
      parsed.legacyMtimeMs < 0
    ) {
      return null;
    }
    return {
      fence: { protocol: "legacy", generation: parsed.generation },
      legacyMtimeMs: parsed.legacyMtimeMs,
    };
  } catch {
    return null;
  }
}

function readPluginBuildLockGeneration(generationDir: string): string | null {
  try {
    const generation = fs
      .readFileSync(
        path.join(generationDir, PLUGIN_BUILD_LOCK_GENERATION_FILE),
        "utf8",
      )
      .trim();
    return isPluginBuildLockGeneration(generation) ? generation : null;
  } catch {
    return null;
  }
}

function isPluginBuildLockGeneration(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
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
 * Age of an observed lock directory, or `null` when it no longer exists. The
 * holder may have retired it between the caller's checks. "Missing" is a
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

function pluginBuildLockPathExists(lockDir: string): boolean {
  try {
    const stats = fs.lstatSync(lockDir);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: unsafe plugin build lock path: ${lockDir}`);
    }
    return true;
  } catch (error) {
    if (isMissingPathError(error)) return false;
    throw error;
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
  env: NodeJS.ProcessEnv,
): void {
  const goModReader = createGoModReader(goBinary, pluginName, env);
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
 * Separator normalization is itself a quoting trigger. A Windows UNC
 * (`\\server\share\...`) or extended-length (`\\?\C:\...`) path normalizes into
 * a token that starts with `//`, and the modfile lexer reads `//` as a line
 * comment wherever it appears. Emitted bare, such a token turns its whole
 * `use`/`replace` line into a comment: `go` exits 0, reports nothing, and the
 * overlay module simply disappears from the workspace.
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
 * value round-trips through the modfile lexer. A clean bare token is therefore
 * emitted byte-for-byte as before; only tokens that would otherwise be split or
 * interpreted as comments are quoted.
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
    if (!isGoPrintable(ch)) {
      return true;
    }
  }
  return s === "" || s.includes("//") || s.includes("/*");
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

function createGoModReader(
  goBinary: string,
  pluginName: string,
  env: NodeJS.ProcessEnv,
): GoModReader {
  const cache = new Map<string, GoModInfo>();
  return {
    read(dir) {
      const resolved = path.resolve(dir);
      const cached = cache.get(resolved);
      if (cached !== undefined) {
        return cached;
      }
      const info = readGoModInfo(resolved, goBinary, pluginName, env);
      cache.set(resolved, info);
      return info;
    },
  };
}

function readGoModInfo(
  dir: string,
  goBinary: string,
  pluginName: string,
  env: NodeJS.ProcessEnv,
): GoModInfo {
  if (!fs.existsSync(path.join(dir, "go.mod"))) {
    return emptyGoModInfo();
  }

  const result = spawnGoTool(goBinary, ["mod", "edit", "-json"], {
    cwd: dir,
    encoding: "utf8",
    env: goBuildEnv(goBinary, undefined, env),
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
  env: NodeJS.ProcessEnv,
  normalizeGoToolPermissions: boolean,
): void {
  ensureExecutableGoToolchain(goBinary, normalizeGoToolPermissions);
  const result = spawnGoTool(goBinary, ["build", "-o", binaryName, entry], {
    cwd,
    encoding: "utf8",
    env: goBuildEnv(goBinary, goBuildCacheRoot, env),
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

export function spawnGoTool(
  goBinary: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
): SpawnSyncReturns<string> {
  // The child's streams go to files rather than pipes, so no output ceiling
  // applies: `spawnSync` only bounds what it must hold in this process's
  // memory, and a `go build` that says a great deal is not a failure to invent
  // a limit for. See `captureProcessOutput`.
  const capture = captureProcessOutput();
  const spawnOptions = {
    ...options,
    stdio: ["ignore", capture.stdoutFd, capture.stderrFd] as StdioOptions,
  };
  try {
    const result = spawnGoToolProcess(goBinary, args, spawnOptions, {
      stderr: capture.stderrPath,
      stdout: capture.stdoutPath,
    });
    const stdout = capture.read("stdout", "utf8") as string;
    const stderr = capture.read("stderr", "utf8") as string;
    return {
      ...result,
      output: [null, stdout, stderr],
      stderr,
      stdout,
    };
  } finally {
    capture.dispose();
  }
}

/**
 * Launch the Go tool, routing through cmd.exe only where Windows needs a
 * wrapper. Output routing is the caller's concern; this owns process
 * selection.
 */
function spawnGoToolProcess(
  goBinary: string,
  args: readonly string[],
  options: SpawnSyncOptionsWithStringEncoding,
  output: { stderr: string; stdout: string },
): ReturnType<typeof spawnSync> {
  if (process.platform !== "win32") {
    return spawnSyncResilient(goBinary, args, options, output);
  }
  const inheritedEnv = options.env ?? process.env;
  const resolved = resolveWindowsGoTool(
    goBinary,
    inheritedEnv,
    spawnWorkingDirectory(options.cwd),
  );
  if (!resolved.wrapper) {
    return spawnSync(goBinary, [...args], options);
  }
  // Preserve the native spawn ENOENT contract before cmd.exe becomes the
  // actual child process. The callers use that code for the install guidance.
  if (resolved.location === null) {
    return spawnSync(goBinary, [...args], options);
  }
  const shim = createWindowsGoCommandShim([resolved.location, ...args]);
  return spawnSync(
    readWindowsEnvironmentValue(inheritedEnv, "COMSPEC") ??
      readWindowsEnvironmentValue(process.env, "COMSPEC") ??
      "cmd.exe",
    windowsGoCommandArgs(shim.payload),
    {
      ...options,
      env: { ...inheritedEnv, ...shim.environment },
      shell: false,
      // The /c payload is already one fully quoted Windows command line.
      windowsVerbatimArguments: true,
    },
  );
}

/** Build the fixed cmd.exe switch sequence for one already quoted payload. */
export function windowsGoCommandArgs(payload: string): string[] {
  return ["/d", "/v:off", "/s", "/c", payload];
}

function spawnWorkingDirectory(
  cwd: SpawnSyncOptionsWithStringEncoding["cwd"],
): string {
  if (cwd === undefined) return process.cwd();
  return path.resolve(typeof cwd === "string" ? cwd : fileURLToPath(cwd));
}

function isWindowsCommandWrapper(location: string): boolean {
  return process.platform === "win32" && /\.(?:bat|cmd)$/i.test(location);
}

/** Pass volatile cmd wrapper arguments through one-pass environment expansion. */
function createWindowsGoCommandShim(args: readonly string[]): {
  environment: NodeJS.ProcessEnv;
  payload: string;
} {
  const prefix = `TTSC_GO_COMMAND_SHIM_${crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase()}_ARG_`;
  const environment = Object.fromEntries(
    args.map((arg, index) => [prefix + index, quoteWindowsCommandArg(arg)]),
  );
  return {
    environment,
    // cmd expands each placeholder exactly once. Percent-shaped text inside an
    // expanded value is not scanned as a second environment reference.
    payload: `"${args.map((_, index) => `%${prefix}${index}%`).join(" ")}"`,
  };
}

/** Quote one argv value for the Windows command-line parser used by cmd. */
function quoteWindowsCommandArg(arg: string): string {
  return `"${String(arg)
    .replace(/(\\*)"/g, '$1$1\\"')
    .replace(/(\\*)$/, "$1$1")}"`;
}

function goBuildEnv(
  goBinary: string,
  goBuildCacheRoot?: string,
  effectiveEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env = { ...effectiveEnv };
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

export function ensureExecutableGoToolchain(
  goBinary: string,
  normalizeBundledPermissions: boolean,
): void {
  if (process.platform === "win32") return;
  if (!path.isAbsolute(goBinary) || !fs.existsSync(goBinary)) return;
  try {
    ensureExecutableFile(goBinary, normalizeBundledPermissions);
    const goRoot = inferGoRoot(goBinary);
    if (!goRoot) return;
    const gofmt = path.join(path.dirname(goBinary), "gofmt");
    if (fs.existsSync(gofmt)) {
      ensureExecutableFile(gofmt, normalizeBundledPermissions);
    }
    const toolDir = path.join(goRoot, "pkg", "tool");
    if (!fs.existsSync(toolDir)) return;
    for (const file of walkToolFiles(toolDir)) {
      ensureExecutableFile(file, normalizeBundledPermissions);
    }
  } catch {
    // Let the subsequent go build spawn fail with the real OS error.
  }
}

/** Repair tool execution without widening an explicitly selected toolchain. */
function ensureExecutableFile(
  file: string,
  normalizeBundledPermissions: boolean,
): void {
  const mode = fs.statSync(file).mode & 0o7777;
  if (normalizeBundledPermissions) {
    if (mode !== 0o755) fs.chmodSync(file, 0o755);
  } else if ((mode & 0o111) === 0) {
    fs.chmodSync(file, mode | 0o100);
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
  env: NodeJS.ProcessEnv = process.env,
): string {
  const paths = resolveSourceBuildCachePaths(projectRoot, cacheDir, env);
  maybePruneSourceBuildCaches(paths, cacheDir, env);
  return paths.pluginRoot;
}

/**
 * Resolve all source-plugin build cache directories for one invocation.
 *
 * `pluginRoot` stores compiled plugin binaries; `goBuildRoot` is the Go object
 * cache passed as `GOCACHE` while ttsc builds those binaries. The default Go
 * cache lives under `root`; an explicit `TTSC_GO_CACHE_DIR` or `GOCACHE` keeps
 * its independently resolved location and ownership policy.
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

function maybePruneSourceBuildCaches(
  paths: ITtscSourceBuildCachePaths,
  cacheDir: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  // GC only the default (workspace-local) location. When the user pins an
  // explicit `cacheDir`/`TTSC_CACHE_DIR`, they own its lifetime, so ttsc must
  // not delete entries out from under them. `env` is the effective instance
  // environment so a programmatic caller that pins `TTSC_CACHE_DIR` only in
  // `context.env` is honored without leaning on the shared `process.env`.
  if (!cacheDir && !env.TTSC_CACHE_DIR) {
    prunePluginCacheRoot(paths.pluginRoot);
    if (paths.goBuildRootSource === "ttsc-cache") {
      pruneGoBuildCacheRoot(paths.goBuildRoot);
    }
  }
}

/** Report whether this invocation owns and automatically maintains both caches. */
function shouldManageSourceBuildCaches(
  paths: ITtscSourceBuildCachePaths,
  cacheDir: string | undefined,
  env: NodeJS.ProcessEnv,
): boolean {
  return (
    !cacheDir && !env.TTSC_CACHE_DIR && paths.goBuildRootSource === "ttsc-cache"
  );
}

/**
 * Return every directory `ttsc clean` should remove for `projectRoot`.
 *
 * Covers the resolved plugin-binary root, a safely named nested `go-build/`, a
 * ttsc-owned Go build cache that lives OUTSIDE that root (`TTSC_GO_CACHE_DIR`),
 * and the two legacy project-local caches. A user-provided `GOCACHE` is never
 * removed. Pure over `env`, so the CLI passes `process.env` and a programmatic
 * caller can pass an injected environment.
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

function resolveGoCompiler(env: NodeJS.ProcessEnv = process.env): {
  binary: string;
  bundled: boolean;
} {
  const explicit = env.TTSC_GO_BINARY;
  if (explicit && explicit.length > 0) {
    return { binary: explicit, bundled: false };
  }

  try {
    return {
      binary: createRequire(__filename).resolve(
        `@ttsc/${process.platform}-${process.arch}/bin/go/bin/${process.platform === "win32" ? "go.exe" : "go"}`,
      ),
      bundled: true,
    };
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
  if (fs.existsSync(platformPackage)) {
    return { binary: platformPackage, bundled: true };
  }

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
  if (fs.existsSync(local)) return { binary: local, bundled: true };

  const homeSdk = path.join(
    env.HOME ?? "",
    "go-sdk",
    "go",
    "bin",
    process.platform === "win32" ? "go.exe" : "go",
  );
  if (fs.existsSync(homeSdk)) return { binary: homeSdk, bundled: false };

  return { binary: "go", bundled: false };
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
  env?: NodeJS.ProcessEnv;
  filesystem?: Partial<SourceBuildFilesystemOperations>;
  goBinary?: string;
  overlayDirs?: readonly string[];
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const env = inputs.env ?? process.env;
  const filesystem: SourceBuildFilesystemOperations = {
    readFile:
      inputs.filesystem?.readFile ?? DEFAULT_SOURCE_BUILD_FILESYSTEM.readFile,
  };
  const goBinary =
    inputs.goBinary === undefined
      ? undefined
      : resolveGoToolForBuild(inputs.goBinary, env, inputs.dir);
  const hash = crypto.createHash("sha256");
  hash.update(`ttsc=${inputs.ttscVersion}\n`);
  hash.update(`tsgo=${inputs.tsgoVersion}\n`);
  hash.update(`platform=${process.platform}/${process.arch}\n`);
  hash.update(`entry=${inputs.entry}\n`);
  if (goBinary !== undefined) {
    hash.update(`go=${resolveGoCompilerIdentity(goBinary, env, inputs.dir)}\n`);
  }
  hashGoBuildEnvironment(hash, goBinary, inputs.dir, env, filesystem);
  hashExternalGoBuildEnvironment(hash, env);
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
// content signature (filesystem identity, mode, byte size, and nanosecond
// change/modify times). That signature changes if a long-lived host rewrites
// or atomically replaces the binary between calls, so the memo
// re-derives the identity exactly as the un-memoized code would and the
// cache-key bytes stay byte-for-byte identical to today. The selected compiler
// path is shared by every build subprocess on Windows, while `go version` uses
// the same effective cwd and environment as the cache-key `go env` query. The
// memo key includes that context so an environment-sensitive wrapper cannot
// lend its version result to another compiler invocation.
const goCompilerIdentityCache = new Map<string, string>();

function resolveGoCompilerIdentity(
  goBinary: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const selected = resolveGoToolForBuild(goBinary, env, cwd);
  const resolved =
    process.platform === "win32"
      ? resolveRealPath(selected)
      : resolveExecutableIdentityPath(selected, env, cwd);
  const compilerEnv = goBuildEnv(selected, undefined, env);
  const memoKey = goCompilerIdentityMemoKey(
    goBinary,
    resolved,
    compilerEnv,
    cwd,
  );
  if (memoKey !== null) {
    const cached = goCompilerIdentityCache.get(memoKey);
    if (cached !== undefined) {
      return cached;
    }
  }
  const identity = computeGoCompilerIdentity(
    selected,
    resolved,
    compilerEnv,
    cwd,
  );
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
  env: NodeJS.ProcessEnv,
  cwd: string,
): string | null {
  try {
    const stat = fs.statSync(resolved, { bigint: true });
    const context = crypto.createHash("sha256");
    context.update(cwd);
    for (const [key, value] of Object.entries(env).sort(([left], [right]) =>
      left === right ? 0 : left < right ? -1 : 1,
    )) {
      if (value === undefined) continue;
      context.update(`\0${key.length}:${key}${value.length}:${value}`);
    }
    return [
      goBinary,
      resolved,
      stat.dev,
      stat.ino,
      stat.mode,
      stat.size,
      stat.mtimeNs,
      stat.ctimeNs,
      context.digest("hex"),
    ].join("\0");
  } catch {
    return null;
  }
}

function computeGoCompilerIdentity(
  goBinary: string,
  resolved: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string {
  if (!fs.existsSync(resolved)) {
    return "missing";
  }
  const version = spawnGoTool(goBinary, ["version"], {
    cwd,
    encoding: "utf8",
    env,
    windowsHide: true,
  });
  const versionText =
    version.error !== undefined
      ? ((version.error as NodeJS.ErrnoException).code ?? version.error.message)
      : `${version.status ?? 0}:${version.stdout}${version.stderr}`;
  const binaryHash = hashFile(resolved);
  return `sha256:${binaryHash}:${versionText}`;
}

function resolveExecutableIdentityPath(
  binary: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  const resolved = findExecutablePath(binary, env, cwd);
  return resolved === null ? binary : resolveRealPath(resolved);
}

/** Pin Windows PATH and command-wrapper lookup to one build-wide target. */
function resolveGoToolForBuild(
  binary: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string {
  if (process.platform !== "win32") return binary;
  return resolveWindowsGoTool(binary, env, cwd).location ?? binary;
}

function findExecutablePath(
  binary: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string | null {
  for (const candidate of executableSearchBases(binary, env, cwd)) {
    const resolved = findExecutableCandidate(candidate, env);
    if (resolved !== null) return resolved;
  }
  return null;
}

interface IWindowsGoToolResolution {
  location: string | null;
  wrapper: boolean;
}

/** Preserve libuv's native target before falling back to cmd/bat wrappers. */
function resolveWindowsGoTool(
  binary: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): IWindowsGoToolResolution {
  const candidates = executableSearchBases(binary, env, cwd);
  if (isWindowsCommandWrapper(binary)) {
    return {
      location: candidates.find(isExecutableFile) ?? null,
      wrapper: true,
    };
  }

  const hasExtension = windowsFileNameHasExtension(binary);
  for (const candidate of candidates) {
    if (hasExtension && isExecutableFile(candidate)) {
      return { location: candidate, wrapper: false };
    }
    for (const extension of [".com", ".exe"]) {
      const executable = candidate + extension;
      if (isExecutableFile(executable)) {
        return { location: executable, wrapper: false };
      }
    }
  }

  const wrapperExtensions = windowsExecutableExtensions(env).filter((ext) =>
    /\.(?:bat|cmd)$/i.test(ext),
  );
  for (const candidate of candidates) {
    for (const extension of wrapperExtensions) {
      const executable = candidate + extension;
      if (isExecutableFile(executable)) {
        return { location: executable, wrapper: true };
      }
    }
  }
  return { location: null, wrapper: false };
}

function executableSearchBases(
  binary: string,
  env: NodeJS.ProcessEnv,
  cwd: string,
): string[] {
  if (path.isAbsolute(binary)) return [binary];
  if (hasPathQualifier(binary)) return [path.resolve(cwd, binary)];

  const directories =
    process.platform === "win32"
      ? splitWindowsSearchPath(readPathEnvironment(env))
          // libuv skips only genuinely empty slices. A quoted-empty slice
          // survives that check, unquotes to "", and therefore names cwd.
          .filter((entry) => entry.length > 0)
          .map(unquoteWindowsSearchEntry)
      : readPathEnvironment(env).split(path.delimiter);
  const noDefaultCurrentDirectory =
    process.platform === "win32"
      ? readWindowsEnvironmentValue(
          process.env,
          "NoDefaultCurrentDirectoryInExePath",
        )
      : undefined;
  if (process.platform === "win32" && noDefaultCurrentDirectory === undefined) {
    directories.unshift(cwd);
  }
  return directories.map((dir) => path.resolve(cwd, dir, binary));
}

function findExecutableCandidate(
  candidate: string,
  env: NodeJS.ProcessEnv,
): string | null {
  if (isExecutableFile(candidate)) return candidate;
  if (process.platform !== "win32") return null;
  // Probe every PATHEXT extension, not just `.exe`, so a compiler backed by a
  // `.cmd`/`.bat` wrapper is both launched correctly and hashed into the cache
  // key. Otherwise the wrapper reads as missing and changes do not invalidate
  // the cached plugin binary.
  for (const ext of windowsExecutableExtensions(env)) {
    const executable = `${candidate}${ext}`;
    if (isExecutableFile(executable)) return executable;
  }
  return null;
}

function isExecutableFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}

function hasPathQualifier(location: string): boolean {
  return (
    location.includes(path.sep) ||
    (process.platform === "win32" &&
      (location.includes("/") || /^[a-zA-Z]:/.test(location)))
  );
}

function windowsFileNameHasExtension(location: string): boolean {
  const name = path.basename(location);
  const dot = name.indexOf(".");
  return dot >= 0 && dot < name.length - 1;
}

function splitWindowsSearchPath(value: string): string[] {
  const entries: string[] = [];
  let start = 0;
  let quote = "";
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (quote !== "") {
      if (character === quote) quote = "";
    } else if ((character === '"' || character === "'") && index === start) {
      quote = character;
    } else if (character === ";") {
      entries.push(value.slice(start, index));
      start = index + 1;
    }
  }
  entries.push(value.slice(start));
  return entries;
}

function unquoteWindowsSearchEntry(location: string): string {
  const first = location[0];
  const withoutFirst =
    first === '"' || first === "'" ? location.slice(1) : location;
  const last = withoutFirst[withoutFirst.length - 1];
  return last === '"' || last === "'"
    ? withoutFirst.slice(0, -1)
    : withoutFirst;
}

function windowsExecutableExtensions(
  env: NodeJS.ProcessEnv = process.env,
): readonly string[] {
  const pathext = readWindowsEnvironmentValue(env, "PATHEXT");
  const raw = pathext && pathext.length > 0 ? pathext : ".COM;.EXE;.BAT;.CMD";
  return splitWindowsSearchPath(raw)
    .map(unquoteWindowsSearchEntry)
    .map((ext) => ext.toLowerCase())
    .filter((ext) => ext.length > 0);
}

function readPathEnvironment(env: NodeJS.ProcessEnv = process.env): string {
  return process.platform === "win32"
    ? (readWindowsEnvironmentValue(env, "PATH") ??
        readWindowsEnvironmentValue(process.env, "PATH") ??
        "")
    : (env.PATH ?? "/usr/bin:/bin");
}

function readWindowsEnvironmentValue(
  env: NodeJS.ProcessEnv,
  name: string,
): string | undefined {
  const exact = env[name];
  if (exact !== undefined) return exact;
  const normalized = name.toLowerCase();
  const key = Object.keys(env)
    .filter((candidate) => candidate.toLowerCase() === normalized)
    .sort()[0];
  return key === undefined ? undefined : env[key];
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
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
): void {
  const values = resolveGoBuildEnvironment(goBinary, cwd, env, filesystem);
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
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
): Map<string, string> {
  const values = new Map<string, string>();
  if (goBinary !== undefined) {
    const result = spawnGoTool(
      goBinary,
      ["env", "-json", ...GO_BUILD_ENV_KEYS],
      {
        cwd,
        encoding: "utf8",
        env: goBuildEnv(goBinary, undefined, env),
        windowsHide: true,
      },
    );
    if (result.error === undefined && result.status === 0) {
      try {
        const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
        for (const key of GO_BUILD_ENV_KEYS) {
          const raw = parsed[key];
          if (typeof raw === "string" && raw !== "") {
            values.set(
              key,
              normalizeGoBuildEnvValue(key, raw, env, filesystem),
            );
          }
        }
      } catch {
        // Fall back to the effective env below; a cache key is still better
        // than failing before `go build` can produce the actionable error.
      }
    }
  }
  for (const key of GO_BUILD_ENV_KEYS) {
    if (values.has(key)) continue;
    const value = env[key];
    if (value !== undefined && value !== "") {
      values.set(key, normalizeGoBuildEnvValue(key, value, env, filesystem));
    }
  }
  return values;
}

function normalizeGoBuildEnvValue(
  key: string,
  value: string,
  env: NodeJS.ProcessEnv,
  filesystem: SourceBuildFilesystemOperations,
): string {
  if (key === "GOROOT") {
    return resolveGoRootCacheIdentity(value, filesystem);
  }
  if (GO_BUILD_COMMAND_ENV_KEYS.has(key)) {
    return `${value}\0${resolveCommandCacheIdentity(value, env)}`;
  }
  return value;
}

function resolveCommandCacheIdentity(
  command: string,
  env: NodeJS.ProcessEnv,
): string {
  const executable = firstCommandToken(command);
  if (executable === null) {
    return "command:empty";
  }
  const resolved = resolveExecutableIdentityPath(executable, env);
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

function hashExternalGoBuildEnvironment(
  hash: crypto.Hash,
  env: NodeJS.ProcessEnv,
): void {
  for (const key of EXTERNAL_GO_BUILD_ENV_KEYS) {
    const value = env[key];
    if (value !== undefined && value !== "") {
      hash.update(`${key}=${value}\n`);
    }
  }
}

interface GoRootIdentitySnapshot {
  complete: boolean;
  files: string[];
  signature: string;
}

interface GoRootIdentityCacheEntry {
  identity: string;
  signature: string;
}

// GOROOT is immutable during normal use but contributes roughly 140 MiB of
// source/tool content to every plugin key. Retain only the final pathless
// content identity, guarded by a fresh metadata manifest on every call. A
// changed or incomplete manifest falls through to the historical full read.
const goRootIdentityCache = new Map<string, GoRootIdentityCacheEntry>();

function resolveGoRootCacheIdentity(
  goRoot: string,
  filesystem: SourceBuildFilesystemOperations,
): string {
  const resolved = resolveRealPath(goRoot);
  if (!fs.existsSync(resolved)) {
    return `missing:${goRoot}`;
  }
  const snapshot = collectGoRootIdentitySnapshot(resolved);
  if (snapshot.complete) {
    const cached = goRootIdentityCache.get(resolved);
    if (cached?.signature === snapshot.signature) {
      return cached.identity;
    }
  }
  const hash = crypto.createHash("sha256");
  for (const file of snapshot.files) {
    const relative = path.relative(resolved, file).replace(/\\/g, "/");
    hash.update(`f=${relative}\n`);
    hash.update(filesystem.readFile(file));
    hash.update("\n");
  }
  const identity = `sha256:${hash.digest("hex")}`;
  if (snapshot.complete) {
    goRootIdentityCache.set(resolved, {
      identity,
      signature: snapshot.signature,
    });
  }
  return identity;
}

function collectGoRootIdentitySnapshot(root: string): GoRootIdentitySnapshot {
  const out: string[] = [];
  const state = { complete: true };
  walkGoRootIdentity(root, root, out, state);
  out.sort();
  const signature = crypto.createHash("sha256");
  for (const file of out) {
    const relative = path.relative(root, file).replace(/\\/g, "/");
    try {
      const stats = fs.statSync(file, { bigint: true });
      if (!stats.isFile()) {
        state.complete = false;
        continue;
      }
      signature.update(
        [
          relative,
          stats.dev,
          stats.ino,
          stats.mode,
          stats.size,
          stats.mtimeNs,
          stats.ctimeNs,
        ].join("\0"),
      );
      signature.update("\n");
    } catch {
      state.complete = false;
    }
  }
  return {
    complete: state.complete,
    files: out,
    signature: signature.digest("hex"),
  };
}

function walkGoRootIdentity(
  root: string,
  dir: string,
  out: string[],
  state: { complete: boolean },
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    state.complete = false;
    return;
  }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    const rel = path.relative(root, file).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      if (shouldHashGoRootPath(rel, true)) {
        walkGoRootIdentity(root, file, out, state);
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
    replaceCacheMetadataFile(
      path.join(cacheDir, CACHE_LAST_USED_FILE),
      `${Date.now()}\n`,
    );
  } catch {
    // Cache hits must not fail because metadata touch failed.
  }
}

/** Test/internal controls for deterministic plugin-binary cache maintenance. */
export interface IPluginCachePruneOptions {
  /** Ignore the once-daily marker. */
  force?: boolean;
  /** Size that triggers LRU pruning. */
  maxBytes?: number;
  /** Injected clock for deterministic tests. */
  now?: number;
  /** Recent-entry protection window. */
  protectedAgeMs?: number;
  /** Entries whose binary was returned by the current cold build. */
  protectedEntries?: readonly string[];
  /** Size to prune toward once the ceiling is crossed. */
  targetBytes?: number;
}

export function prunePluginCacheRoot(
  root: string,
  options: IPluginCachePruneOptions = {},
): void {
  try {
    const cacheRoot = canonicalPluginCacheRoot(root);
    const marker = path.join(cacheRoot, CACHE_GC_MARKER_FILE);
    const now = options.now ?? Date.now();
    const lastRun = readTimestamp(marker);
    if (
      options.force !== true &&
      lastRun !== null &&
      lastRun <= now &&
      now - lastRun < PLUGIN_CACHE_GC_INTERVAL_MS
    ) {
      return;
    }
    const remainingBytes = prunePluginCacheEntries(cacheRoot, {
      maxBytes: options.maxBytes ?? PLUGIN_CACHE_MAX_BYTES,
      now,
      protectedEntries: canonicalPluginCacheProtectedEntries(
        cacheRoot,
        options.protectedEntries ?? [],
      ),
      protectedAgeMs: options.protectedAgeMs ?? PLUGIN_CACHE_PROTECTED_AGE_MS,
      targetBytes: options.targetBytes ?? PLUGIN_CACHE_TARGET_BYTES,
    });
    const maxBytes = options.maxBytes ?? PLUGIN_CACHE_MAX_BYTES;
    const protectedAgeMs =
      options.protectedAgeMs ?? PLUGIN_CACHE_PROTECTED_AGE_MS;
    const markerTimestamp =
      remainingBytes > maxBytes
        ? now - PLUGIN_CACHE_GC_INTERVAL_MS + protectedAgeMs
        : now;
    replaceCacheMetadataFile(marker, `${markerTimestamp}\n`);
  } catch {
    // Plugin-cache GC is opportunistic; builds still proceed when it fails.
  }
}

/** Resolve explicit GC exclusions without allowing an alias outside root. */
function canonicalPluginCacheProtectedEntries(
  root: string,
  entries: readonly string[],
): Set<string> {
  const protectedEntries = new Set<string>();
  for (const entry of entries) {
    const candidate = path.resolve(entry);
    const stats = fs.lstatSync(candidate);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      throw new Error(`ttsc: unsafe protected plugin cache entry: ${entry}`);
    }
    const physical = fs.realpathSync.native(candidate);
    if (path.dirname(physical) !== root) {
      throw new Error(
        `ttsc: protected plugin cache entry escaped root: ${entry}`,
      );
    }
    protectedEntries.add(physical);
  }
  return protectedEntries;
}

/** Pin the default plugin cache to one ordinary physical directory. */
function canonicalPluginCacheRoot(root: string): string {
  fs.mkdirSync(root, { recursive: true });
  const physicalParent = fs.realpathSync.native(path.dirname(root));
  const stats = fs.lstatSync(root);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`ttsc: unsafe plugin cache root: ${root}`);
  }
  // If an ancestor alias is retargeted after this point, all later cache work
  // stays on the original physical directory rather than following it.
  const physicalRoot = fs.realpathSync.native(root);
  if (path.dirname(physicalRoot) !== physicalParent) {
    throw new Error(`ttsc: plugin cache root escaped its parent: ${root}`);
  }
  return physicalRoot;
}

/** Create one content-addressed cache entry without following a leaf alias. */
function canonicalPluginCacheEntry(root: string, key: string): string {
  const directory = path.join(root, key);
  fs.mkdirSync(directory, { recursive: true });
  const stats = fs.lstatSync(directory);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`ttsc: unsafe plugin cache entry: ${directory}`);
  }
  const physicalDirectory = fs.realpathSync.native(directory);
  if (path.dirname(physicalDirectory) !== root) {
    throw new Error(`ttsc: plugin cache entry escaped its root: ${directory}`);
  }
  return physicalDirectory;
}

function prunePluginCacheEntries(
  root: string,
  options: {
    maxBytes: number;
    now: number;
    protectedAgeMs: number;
    protectedEntries: ReadonlySet<string>;
    targetBytes: number;
  },
): number {
  const entries = collectPluginCacheEntries(root, options.now);
  for (const entry of entries) {
    if (
      options.now - entry.lastUsedAt <= PLUGIN_CACHE_ENTRY_MAX_AGE_MS ||
      options.protectedEntries.has(entry.dir) ||
      pluginCacheEntryHasActiveBuild(entry, options.now)
    ) {
      continue;
    }
    removeCacheEntry(entry);
  }

  const remaining = collectPluginCacheEntries(root, options.now);
  let total = remaining.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= options.maxBytes) {
    return total;
  }
  const protectedEntries = new Set<string>(options.protectedEntries);
  let protectedBytes = 0;
  for (const entry of [...remaining].sort(
    (a, b) => b.lastUsedAt - a.lastUsedAt,
  )) {
    if (pluginCacheEntryHasActiveBuild(entry, options.now)) {
      protectedEntries.add(entry.dir);
      continue;
    }
    if (options.now - entry.lastUsedAt > options.protectedAgeMs) continue;
    if (protectedBytes >= options.targetBytes) continue;
    if (protectedBytes + entry.size > options.targetBytes) continue;
    protectedEntries.add(entry.dir);
    protectedBytes += entry.size;
  }
  for (const entry of remaining.sort((a, b) => a.lastUsedAt - b.lastUsedAt)) {
    if (total <= options.targetBytes) {
      return total;
    }
    if (protectedEntries.has(entry.dir)) continue;
    if (removeCacheEntry(entry)) total -= entry.size;
  }
  return total;
}

/** Conservatively protect an entry while any build generation owns its key. */
function pluginCacheEntryHasActiveBuild(
  entry: PluginCacheEntry,
  now: number,
): boolean {
  const lockDir = `${entry.dir}.lock`;
  try {
    return inspectPluginBuildLock(lockDir, now).state === "active";
  } catch {
    // Malformed or unreadable coordination state cannot disprove ownership.
    return true;
  }
}

/** Test/internal controls for deterministic Go object-cache maintenance. */
export interface IGoBuildCachePruneOptions {
  /** Ignore the once-daily marker. */
  force?: boolean;
  /** Size that triggers LRU pruning. */
  maxBytes?: number;
  /** Size to prune toward once the ceiling is crossed. */
  targetBytes?: number;
  /** Injected clock for deterministic tests. */
  now?: number;
  /** Recent-file protection window. */
  protectedAgeMs?: number;
}

/**
 * Opportunistically bound one ttsc-owned Go object cache.
 *
 * A maintenance intent blocks new build leases. If any existing lease remains,
 * maintenance yields without touching the cache; the next invocation retries.
 * Only Go's two-hex object directories are scanned, so coordination metadata
 * and Go's own trim marker remain outside the size policy.
 */
export function pruneGoBuildCacheRoot(
  root: string,
  options: IGoBuildCachePruneOptions = {},
): void {
  let intent: GoBuildCacheCoordinationRecord | undefined;
  try {
    const cacheRoot = canonicalGoBuildCacheRoot(root);
    const marker = path.join(cacheRoot, GO_BUILD_CACHE_GC_MARKER_FILE);
    const now = options.now ?? Date.now();
    const lastRun = readTimestamp(marker);
    if (
      options.force !== true &&
      lastRun !== null &&
      lastRun <= now &&
      now - lastRun < GO_BUILD_CACHE_GC_INTERVAL_MS
    ) {
      return;
    }

    intent = createGoBuildCacheCoordinationRecord(
      cacheRoot,
      GO_BUILD_CACHE_MAINTENANCE_DIR,
    );
    if (!intent.startHeartbeat()) {
      // Maintenance is opportunistic. Without an independent heartbeat a
      // synchronous scan could look abandoned while it is still deleting, so
      // yield instead of weakening the build/maintenance exclusion.
      return;
    }
    if (
      collectLiveGoBuildCacheCoordinationRecords(
        cacheRoot,
        GO_BUILD_CACHE_LEASE_DIR,
        now,
      ).length !== 0
    ) {
      return;
    }

    const remainingBytes = pruneGoBuildCacheEntries(cacheRoot, {
      maxBytes: options.maxBytes ?? GO_BUILD_CACHE_MAX_BYTES,
      now,
      protectedAgeMs: options.protectedAgeMs ?? GO_BUILD_CACHE_PROTECTED_AGE_MS,
      targetBytes: options.targetBytes ?? GO_BUILD_CACHE_TARGET_BYTES,
    });
    // If recent protection or a transient delete failure left the cache above
    // the ceiling, retry after the protection window instead of suppressing
    // every maintenance attempt for a full day.
    const maxBytes = options.maxBytes ?? GO_BUILD_CACHE_MAX_BYTES;
    const protectedAgeMs =
      options.protectedAgeMs ?? GO_BUILD_CACHE_PROTECTED_AGE_MS;
    const markerTimestamp =
      remainingBytes > maxBytes
        ? now - GO_BUILD_CACHE_GC_INTERVAL_MS + protectedAgeMs
        : now;
    replaceCacheMetadataFile(marker, `${markerTimestamp}\n`);
  } catch {
    // Go-cache GC is opportunistic; builds still proceed when it fails.
  } finally {
    intent?.finish();
  }
}

/**
 * Run one Go build under a cross-process cache lease when ttsc owns the cache.
 *
 * The lease is published before checking maintenance. A maintenance process
 * that arrived first keeps its intent visible, so this builder withdraws and
 * retries; one that arrives second sees the lease and yields. That ordering
 * closes the scan/start race without serializing independent Go builds.
 */
export function withGoBuildCacheLease<T>(
  root: string,
  managed: boolean,
  callback: (cacheRoot: string) => T,
): T {
  if (!managed) {
    return callback(root);
  }
  const cacheRoot = canonicalGoBuildCacheRoot(root);
  const started = Date.now();
  for (;;) {
    const lease = createGoBuildCacheCoordinationRecord(
      cacheRoot,
      GO_BUILD_CACHE_LEASE_DIR,
    );
    const maintenance = collectLiveGoBuildCacheCoordinationRecords(
      cacheRoot,
      GO_BUILD_CACHE_MAINTENANCE_DIR,
      Date.now(),
    );
    if (maintenance.length === 0) {
      try {
        if (!lease.startHeartbeat()) {
          throw new Error(
            `ttsc: unable to start Go build cache lease heartbeat at ${cacheRoot}`,
          );
        }
        return callback(cacheRoot);
      } finally {
        lease.finish();
      }
    }
    lease.finish();
    if (Date.now() - started > PLUGIN_BUILD_LOCK_STEAL_MS) {
      throw new Error(
        `ttsc: timed out waiting for Go build cache maintenance at ${cacheRoot}`,
      );
    }
    sleepSync(GO_BUILD_CACHE_COORDINATION_POLL_MS);
  }
}

/**
 * Create and pin the owned Go cache to an ordinary physical directory.
 *
 * The leaf may be user-controlled inside `node_modules/.cache`; accepting a
 * symlink or junction there would let LRU deletion escape into an arbitrary
 * two-hex directory. Returning the canonical spelling also keeps the build,
 * leases, and maintenance on the same directory if an ancestor alias moves.
 */
function canonicalGoBuildCacheRoot(root: string): string {
  fs.mkdirSync(root, { recursive: true });
  const physicalParent = fs.realpathSync.native(path.dirname(root));
  const stats = fs.lstatSync(root);
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`ttsc: unsafe Go build cache root: ${root}`);
  }
  const physicalRoot = fs.realpathSync.native(root);
  if (path.dirname(physicalRoot) !== physicalParent) {
    throw new Error(`ttsc: Go build cache root escaped its parent: ${root}`);
  }
  return physicalRoot;
}

interface GoBuildCacheObject {
  file: string;
  lastUsedAt: number;
  size: number;
}

/** Prune oldest Go cache objects to the requested deterministic size target. */
function pruneGoBuildCacheEntries(
  root: string,
  options: {
    maxBytes: number;
    now: number;
    protectedAgeMs: number;
    targetBytes: number;
  },
): number {
  const entries = collectGoBuildCacheObjects(root);
  let total = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= options.maxBytes) {
    return total;
  }
  // Protect the newest recent objects only up to one target-sized cohort
  // reserve. Protecting every object younger than an hour would let repeated
  // 2.9 GiB cold builds grow without bound during that hour.
  const protectedFiles = new Set<string>();
  let protectedBytes = 0;
  for (const entry of [...entries].sort(
    (a, b) => b.lastUsedAt - a.lastUsedAt,
  )) {
    if (
      options.now - entry.lastUsedAt >
      options.protectedAgeMs + GO_BUILD_CACHE_ACCESS_MTIME_GRANULARITY_MS
    ) {
      continue;
    }
    if (protectedBytes >= options.targetBytes) {
      break;
    }
    if (protectedBytes + entry.size > options.targetBytes) {
      break;
    }
    protectedFiles.add(entry.file);
    protectedBytes += entry.size;
  }
  for (const entry of entries.sort((a, b) => a.lastUsedAt - b.lastUsedAt)) {
    if (total <= options.targetBytes) {
      return total;
    }
    if (protectedFiles.has(entry.file)) {
      continue;
    }
    try {
      fs.rmSync(entry.file, { force: true });
      total -= entry.size;
    } catch {
      // A concurrent antivirus/indexer can transiently hold a file on Windows.
    }
  }
  return total;
}

function collectGoBuildCacheObjects(root: string): GoBuildCacheObject[] {
  const output: GoBuildCacheObject[] = [];
  let buckets: fs.Dirent[];
  try {
    buckets = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const bucket of buckets) {
    if (!bucket.isDirectory() || !/^[0-9a-f]{2}$/.test(bucket.name)) {
      continue;
    }
    const directory = path.join(root, bucket.name);
    let files: fs.Dirent[];
    try {
      files = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.isFile()) {
        continue;
      }
      const absolute = path.join(directory, file.name);
      try {
        const stats = fs.statSync(absolute);
        output.push({
          file: absolute,
          lastUsedAt: stats.mtimeMs,
          size: stats.size,
        });
      } catch {}
    }
  }
  return output;
}

interface GoBuildCacheCoordinationRecord {
  file: string;
  finish: () => void;
  startHeartbeat: () => boolean;
}

function createGoBuildCacheCoordinationRecord(
  root: string,
  directoryName: string,
): GoBuildCacheCoordinationRecord {
  const directory = goBuildCacheCoordinationDirectory(
    root,
    directoryName,
    true,
  )!;
  const record = path.join(
    directory,
    `${process.pid}-${crypto.randomBytes(16).toString("hex")}.json`,
  );
  const metadata = {
    directoryName,
    hostname: os.hostname(),
    pid: process.pid,
    startedAt: Date.now(),
  };
  writeGoBuildCacheCoordinationRecord(record, metadata, "active");
  let heartbeat: GoBuildCacheHeartbeat | undefined;
  return {
    file: record,
    finish: () => {
      heartbeat?.stop();
      heartbeat = undefined;
      // A failed unlink must not leave a completed task looking active until
      // its stale timeout. Persist completion first; collectors discard it.
      try {
        writeGoBuildCacheCoordinationRecord(record, metadata, "complete");
      } catch {}
      try {
        fs.rmSync(record, { force: true });
      } catch {}
    },
    startHeartbeat: () => {
      heartbeat ??= startGoBuildCacheHeartbeat(record);
      return heartbeat !== undefined;
    },
  };
}

function writeGoBuildCacheCoordinationRecord(
  file: string,
  metadata: {
    directoryName: string;
    hostname: string;
    pid: number;
    startedAt: number;
  },
  status: "active" | "complete",
): void {
  replaceCacheMetadataFile(
    file,
    `${JSON.stringify({ ...metadata, status, version: 1 })}\n`,
  );
}

interface GoBuildCacheHeartbeat {
  stop: () => void;
}

/** Refresh one synchronous cache task's record from a background worker. */
function startGoBuildCacheHeartbeat(
  file: string,
): GoBuildCacheHeartbeat | undefined {
  const control = new SharedArrayBuffer(4);
  const state = new Int32Array(control);
  try {
    const worker = new Worker(
      [
        'const fs = process.getBuiltinModule("node:fs");',
        'const { workerData } = process.getBuiltinModule("node:worker_threads");',
        "const state = new Int32Array(workerData.control);",
        "for (;;) {",
        "  const result = Atomics.wait(state, 0, 0, workerData.interval);",
        '  if (result !== "timed-out" || Atomics.load(state, 0) !== 0) break;',
        "  try {",
        "    const now = new Date();",
        "    fs.utimesSync(workerData.file, now, now);",
        "  } catch {}",
        "}",
      ].join("\n"),
      {
        eval: true,
        workerData: {
          control,
          file,
          interval: GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS,
        },
      },
    );
    worker.unref();
    return {
      stop: () => {
        Atomics.store(state, 0, 1);
        Atomics.notify(state, 0);
        void worker.terminate();
      },
    };
  } catch {}

  // Node's permission model can deny Worker construction while still allowing
  // the child process required for `go build`. The fallback inherits only the
  // low standard descriptors and checks its parent PID. An IPC channel would
  // allocate another high descriptor and recreate Darwin's spawn EBADF limit.
  try {
    const child = spawn(
      process.execPath,
      [
        "-e",
        [
          'const fs = require("node:fs");',
          "const file = process.argv[1];",
          "const interval = Number(process.argv[2]);",
          "const parent = Number(process.argv[3]);",
          "const timer = setInterval(() => {",
          "  try { process.kill(parent, 0); } catch { clearInterval(timer); process.exit(0); }",
          "  try {",
          "    const now = new Date();",
          "    fs.utimesSync(file, now, now);",
          "  } catch {}",
          "}, interval);",
        ].join("\n"),
        file,
        String(GO_BUILD_CACHE_COORDINATION_HEARTBEAT_MS),
        String(process.pid),
      ],
      {
        stdio: [0, 1, 2],
        windowsHide: true,
      },
    );
    child.unref();
    return {
      stop: () => {
        child.kill();
      },
    };
  } catch {
    return undefined;
  }
}

function collectLiveGoBuildCacheCoordinationRecords(
  root: string,
  directoryName: string,
  now: number,
): string[] {
  const directory = goBuildCacheCoordinationDirectory(
    root,
    directoryName,
    false,
  );
  if (directory === undefined) return [];
  let records: fs.Dirent[];
  try {
    records = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const live: string[] = [];
  for (const record of records) {
    if (!record.isFile()) {
      continue;
    }
    const file = path.join(directory, record.name);
    if (goBuildCacheCoordinationRecordIsLive(file, directoryName, now)) {
      live.push(file);
      continue;
    }
    try {
      fs.rmSync(file, { force: true });
    } catch {}
  }
  return live;
}

/**
 * Resolve one private coordination directory without following a project-
 * supplied symlink or junction outside the owned Go cache.
 */
function goBuildCacheCoordinationDirectory(
  root: string,
  directoryName: string,
  create: boolean,
): string | undefined {
  if (create) fs.mkdirSync(root, { recursive: true });
  const directory = path.join(root, directoryName);
  if (create) {
    try {
      fs.mkdirSync(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(directory);
  } catch (error) {
    if (!create && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(
      `ttsc: unsafe Go build cache coordination directory: ${directory}`,
    );
  }
  const physicalRoot = fs.realpathSync.native(root);
  const physicalDirectory = fs.realpathSync.native(directory);
  if (path.dirname(physicalDirectory) !== physicalRoot) {
    throw new Error(
      `ttsc: Go build cache coordination directory escaped its root: ${directory}`,
    );
  }
  return physicalDirectory;
}

function goBuildCacheCoordinationRecordIsLive(
  file: string,
  directoryName: string,
  now: number,
): boolean {
  let contents: string | undefined;
  try {
    contents = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(contents) as Record<string, unknown>;
    if (parsed.status === "complete") return false;
    // Parse valid records for forward compatibility, but do not equate a PID's
    // lifetime with one task. A failed unlink can leave a record owned by a
    // still-running Vite process, while a dead Node parent can leave its
    // spawnSync Go child alive. The heartbeat/grace below models the task.
    void parsed;
  } catch {}
  try {
    const age = now - fs.statSync(file).mtimeMs;
    if (age < -GO_BUILD_CACHE_COORDINATION_CLOCK_SKEW_MS) {
      // A restored cache can carry a far-future timestamp, but the same state
      // also occurs when the system clock moves backward during a real build.
      // Rebase the record and grant one ordinary grace period; an active
      // heartbeat keeps refreshing it, while an orphan then expires normally.
      // Treat a failed rebase as live too: the safe failure mode is to defer
      // opportunistic maintenance, never to delete under a possibly live Go.
      // Replace the directory entry rather than changing its inode in place.
      // A restored or user-modified cache can contain a hard-linked record;
      // utimesSync(file) would then mutate metadata outside the owned cache.
      if (contents !== undefined) {
        try {
          replaceCacheMetadataFile(file, contents);
        } catch {}
      }
      return true;
    }
    const staleMs =
      directoryName === GO_BUILD_CACHE_MAINTENANCE_DIR
        ? GO_BUILD_CACHE_MAINTENANCE_STALE_MS
        : GO_BUILD_CACHE_COORDINATION_STALE_MS;
    return age <= staleMs;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
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
    if (
      !dirent.isDirectory() ||
      dirent.name.endsWith(".lock") ||
      dirent.name.includes(".lock.")
    ) {
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

/** Replace cache metadata without following a pre-existing link or hard link. */
function replaceCacheMetadataFile(file: string, contents: string): void {
  const temporary = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}-${crypto
      .randomBytes(16)
      .toString("hex")}.tmp`,
  );
  try {
    fs.writeFileSync(temporary, contents, { encoding: "utf8", flag: "wx" });
    // rename replaces the directory entry itself. Unlike writeFile(file), it
    // cannot follow a symlink or mutate another hard link to the old inode.
    fs.renameSync(temporary, file);
  } finally {
    try {
      fs.rmSync(temporary, { force: true });
    } catch {}
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

function removeCacheEntry(entry: PluginCacheEntry): boolean {
  try {
    fs.rmSync(entry.dir, { recursive: true, force: true });
    return !fs.existsSync(entry.dir);
  } catch {
    // Windows may reject removal while a plugin binary is still running.
    return false;
  }
}
