import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { findNearestGoMod } from "../../../compiler/internal/findNearestGoMod";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import type { ITtscBuildContributor } from "./ITtscBuildContributor";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { GoToolResolution } from "./GoToolResolution";
import { ensureExecutableGoToolchain } from "./ensureExecutableGoToolchain";
import { computeCacheKey } from "./computeCacheKey";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import { prunePluginCacheRoot } from "./prunePluginCacheRoot";
import { withGoBuildCacheLease } from "./withGoBuildCacheLease";
import { pruneGoBuildCacheRoot } from "./pruneGoBuildCacheRoot";
import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { acquirePluginBuildLock } from "./acquirePluginBuildLock";
import { waitForPluginBinary } from "./waitForPluginBinary";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { reclaimPluginBuildLock } from "./reclaimPluginBuildLock";
import { releasePluginBuildLock } from "./releasePluginBuildLock";
import { GoSourceInputs } from "./GoSourceInputs";
import { formatGoWorkPath } from "./formatGoWorkPath";
import { spawnGoTool } from "./spawnGoTool";
import type { ITtscSourceBuildCachePaths } from "./ITtscSourceBuildCachePaths";

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
  const goBinary = GoToolResolution.resolveGoToolForBuild(compiler.binary, env, dir);
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
    ? SourceBuildCacheLayout.canonicalPluginCacheRoot(paths.pluginRoot)
    : paths.pluginRoot;
  SourceBuildCacheLayout.maybePruneSourceBuildCaches({ ...paths, pluginRoot }, opts.cacheDir, env);
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

const GO_MOD_SEARCH_MAX_DEPTH = 3;

const TTSC_GO_MODULE_PATH = "github.com/samchon/ttsc/packages/ttsc";

const TSGO_GO_MODULE_PATH = "github.com/microsoft/typescript-go";

const CONTRIBUTIONS_FILE_NAME = "ttsc_contributions.go";

const CONTRIB_DIRNAME = "contrib";

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
        timeoutMs: PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_STEAL_MS,
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
        if (GoSourceInputs.shouldPruneDirectory(base)) return false;
        if (GoSourceInputs.shouldOmitSourceFile(base)) return false;
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
      if (GoSourceInputs.shouldPruneDirectory(base)) return false;
      if (GoSourceInputs.shouldOmitSourceFile(base)) return false;
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
    env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
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
    env: GoSourceInputs.goBuildEnv(goBinary, goBuildCacheRoot, env),
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

function findTtscOverlayDirs(): readonly string[] {
  const ttscRoot = path.resolve(__dirname, "..", "..", "..", "..");
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
    if (GoSourceInputs.shouldPruneDirectory(entry.name)) continue;
    walkForGoMod(path.join(dir, entry.name), out);
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

function touchCacheEntry(cacheDir: string): void {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    SourceBuildCacheLayout.replaceCacheMetadataFile(
      path.join(cacheDir, SourceBuildCacheLayout.CACHE_LAST_USED_FILE),
      `${Date.now()}\n`,
    );
  } catch {
    // Cache hits must not fail because metadata touch failed.
  }
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
