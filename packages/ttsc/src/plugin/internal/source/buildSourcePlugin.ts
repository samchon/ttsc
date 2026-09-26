import fs from "node:fs";
import path from "node:path";

import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { runHoldingLock } from "../../../internal/runHoldingLock";
import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import type { IPluginModuleReplaceDirectory } from "./IPluginModuleReplaceDirectory";
import type { ITtscBuildContributor } from "./ITtscBuildContributor";
import type { ITtscSourceBuildCachePaths } from "./ITtscSourceBuildCachePaths";
import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { acquirePluginBuildLock } from "./acquirePluginBuildLock";
import { computeCacheKey } from "./computeCacheKey";
import { copiesPluginSourceEntry } from "./copiesPluginSourceEntry";
import { ensureExecutableGoToolchain } from "./ensureExecutableGoToolchain";
import { formatGoWorkPath } from "./formatGoWorkPath";
import { pluginModuleReplaceDirectories } from "./pluginModuleReplaceDirectories";
import { pluginSourceCovers } from "./pluginSourceCovers";
import { pluginSourceDigest } from "./pluginSourceDigest";
import { pruneGoBuildCacheRoot } from "./pruneGoBuildCacheRoot";
import { prunePluginCacheRoot } from "./prunePluginCacheRoot";
import { reclaimPluginBuildLock } from "./reclaimPluginBuildLock";
import { releasePluginBuildLock } from "./releasePluginBuildLock";
import { resolveGoCompiler } from "./resolveGoCompiler";
import { resolvePluginGoModule } from "./resolvePluginGoModule";
import { resolveSourceBuildCachePaths } from "./resolveSourceBuildCachePaths";
import { spawnGoTool } from "./spawnGoTool";
import { waitForPluginBinary } from "./waitForPluginBinary";
import { withGoBuildCacheLease } from "./withGoBuildCacheLease";

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
  /**
   * Digests of the environment each build directory is keyed on, shared by
   * every build of the load and filled with this build's (`computeCacheKey`),
   * so the load reports its plugin sources' states from the same reading
   * (samchon/ttsc#1493).
   */
  environmentDigests?: Map<string, string>;
  filesystem?: Partial<SourceBuildFilesystemOperations>;
  label?: string;
  overlayDirs?: readonly string[];
  quiet?: boolean;
  /**
   * Digests of the source directories the caller's load already read, shared by
   * every build of the load and filled with each directory this build keys on
   * (`computeCacheKey`), so the load can report exactly what its binaries were
   * built from (samchon/ttsc#1487).
   */
  sourceDigests?: Map<string, string>;
  ttscVersion: string;
  tsgoVersion: string;
}): string {
  const env = opts.env ?? process.env;
  const { dir, entry, source } = resolveSourceBuildTarget(opts);
  const overlayDirs = [...(opts.overlayDirs ?? findTtscOverlayDirs())].sort();
  const contributors = opts.contributors ?? [];
  const compiler = resolveGoCompiler(env);
  const goBinary = GoToolResolution.resolveGoToolForBuild(
    compiler.binary,
    env,
    dir,
  );
  ensureExecutableGoToolchain(goBinary, compiler.bundled);
  // The digest of every directory the key covers, as the key read it, which
  // the build proves against what it compiled (samchon/ttsc#1505).
  const sourceDigests = opts.sourceDigests ?? new Map<string, string>();
  const key = computeCacheKey({
    contributors,
    dir,
    entry,
    env,
    filesystem: opts.filesystem,
    goBinary,
    overlayDirs,
    ...(opts.environmentDigests === undefined
      ? {}
      : { environmentDigests: opts.environmentDigests }),
    sourceDigests,
    ttscVersion: opts.ttscVersion,
    tsgoVersion: opts.tsgoVersion,
  });
  const paths = resolveSourceBuildCachePaths(opts.baseDir, opts.cacheDir, env);
  requireCachesOutsideSources(
    [paths.root, paths.goBuildRoot],
    [...sourceDigests.keys()],
  );
  const managePluginCache = !opts.cacheDir && !env.TTSC_CACHE_DIR;
  if (managePluginCache) {
    SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(paths.root);
  }
  const manageGoBuildCache = shouldManageSourceBuildCaches(
    paths,
    opts.cacheDir,
    env,
  );
  const pluginRoot = managePluginCache
    ? SourceBuildCacheLayout.canonicalPluginCacheRoot(paths.pluginRoot)
    : paths.pluginRoot;
  SourceBuildCacheLayout.maybePruneSourceBuildCaches(
    { ...paths, pluginRoot },
    opts.cacheDir,
    env,
  );
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
        keyedDigests: sourceDigests,
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
  /** The digest of every directory the key covers, as the key read it. */
  keyedDigests: ReadonlyMap<string, string>;
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
    requireKeyedSource(
      opts.dir,
      scratchDir,
      opts.keyedDigests,
      opts.pluginName,
    );
    const replacements = pluginModuleReplaceDirectories(
      opts.dir,
      opts.env,
      opts.goBinary,
    );
    // Every source the build would otherwise read in place, an overlay and
    // each replace target outside the module, is copied and proven against the
    // key before Go reads it, as the module and its contributors are: a check
    // after the build cannot tell a source that held still from one that
    // changed and changed back while Go was reading it (samchon/ttsc#1527).
    const external = snapshotExternalSources(
      scratchDir,
      [
        ...opts.overlayDirs,
        ...replacements.map((replacement) => replacement.directory),
      ],
      opts.keyedDigests,
      opts.pluginName,
    );
    anchorReplaceDirectories(
      replacements.map((replacement) => ({
        ...replacement,
        directory: external.get(path.resolve(replacement.directory))!,
      })),
      scratchDir,
      opts.goBinary,
      opts.env,
    );
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
        keyedDigests: opts.keyedDigests,
        pluginName: opts.pluginName,
        scratchDir,
      });
    }
    writeGoWork(
      scratchDir,
      opts.overlayDirs.map((directory) => external.get(path.resolve(directory))!),
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
    const held = lease;
    return runHoldingLock(
      () => {
        // Re-check under the lock: a previous holder may have just published.
        if (fs.existsSync(binaryPath)) {
          touchCacheEntry(cacheDir);
          return binaryPath;
        }
        return build();
      },
      () => releasePluginBuildLock(lockDir, held),
      (error) => reportPluginLockRelease(lockDir, lockInfo, error),
    );
  }
}

function reportPluginLockRelease(
  lockDir: string,
  lockInfo: {
    label: string;
    pluginName: string;
  },
  error: unknown,
): void {
  process.stderr.write(
    `ttsc: could not release the ${lockInfo.label} "${lockInfo.pluginName}" ` +
      `cache lock at ${lockDir} (${error instanceof Error ? error.message : String(error)}); ` +
      `other builds reclaim it once this process exits\n`,
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
  keyedDigests: ReadonlyMap<string, string>;
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
      filter: (src) => copiesPluginSourceEntry(contributor.source, src),
    });
    requireKeyedSource(
      contributor.source,
      target,
      opts.keyedDigests,
      opts.pluginName,
    );
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
  const { entry, moduleRoot } = resolvePluginGoModule(source, opts.pluginName);
  return { dir: moduleRoot, entry, source };
}

function materializeScratchDir(source: string, scratch: string): void {
  fs.mkdirSync(scratch, { recursive: true });
  fs.cpSync(source, scratch, {
    recursive: true,
    filter: (src) => copiesPluginSourceEntry(source, src),
  });
}

/**
 * The path, below a build's scratch directory, of the tree holding its copies
 * of the sources outside the module.
 */
const EXTERNAL_SOURCES_DIRECTORY = path.join(".ttsc", "external");

/**
 * Copy each source directory outside the module into the scratch directory and
 * prove the copy against the key's digest, returning each copy by the
 * directory it was taken from.
 *
 * The copies keep their absolute layout below one root, so a relative path
 * between two of them, such as a driver's `replace` of the shims beside it,
 * still names the copy of what it named. A directory below another is copied
 * with it and again on its own path, which is the same place.
 */
function snapshotExternalSources(
  scratchDir: string,
  directories: readonly string[],
  keyedDigests: ReadonlyMap<string, string>,
  pluginName: string,
): Map<string, string> {
  const root = path.join(scratchDir, EXTERNAL_SOURCES_DIRECTORY);
  const copies = new Map<string, string>();
  for (const directory of new Set(directories.map((dir) => path.resolve(dir)))) {
    const parsed = path.parse(directory);
    const copy = path.join(
      root,
      // A volume's letters alone: a drive, a UNC share, or a `\\?\` prefix
      // leaves nothing that cannot name a directory.
      parsed.root.replace(/[^A-Za-z0-9]+/g, "") || "root",
      path.relative(parsed.root, directory),
    );
    materializeScratchDir(directory, copy);
    requireKeyedSource(directory, copy, keyedDigests, pluginName);
    copies.set(directory, copy);
  }
  return copies;
}

/**
 * Point every `replace` target outside the module at the build's copy of it.
 *
 * The build runs in a scratch copy of the module, where `../dep` names a
 * sibling of the copy instead of the module's sibling that `go build` in the
 * module compiles (samchon/ttsc#1506), and an absolute target would be read in
 * place (samchon/ttsc#1527). The copy's `go.mod` is rewritten to the absolute
 * directory of the proven copy through `go mod edit`, Go's own editor of the
 * file. A target inside the module moved with the copy and is left as it is.
 */
function anchorReplaceDirectories(
  replacements: readonly IPluginModuleReplaceDirectory[],
  scratchDir: string,
  goBinary: string,
  env: NodeJS.ProcessEnv,
): void {
  for (const replacement of replacements) {
    const old =
      replacement.version === undefined
        ? replacement.modulePath
        : `${replacement.modulePath}@${replacement.version}`;
    const result = spawnGoTool(
      goBinary,
      ["mod", "edit", `-replace=${old}=${replacement.directory}`],
      {
        cwd: scratchDir,
        encoding: "utf8",
        env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
        windowsHide: true,
      },
    );
    if (result.error !== undefined || result.status !== 0)
      throw new Error(
        `ttsc: anchoring the replacement of ${old} failed: ${
          result.error?.message ?? (result.stderr || result.stdout)
        }`,
      );
  }
}

/**
 * Refuse a build whose caches lie among the sources its key digests.
 *
 * Every build writes its binary, its lock, and Go's objects below those caches,
 * so a cache inside a keyed source directory changes the source while the build
 * runs: the binary could never be published under the key it was built for
 * (samchon/ttsc#1505), and each later build would key a new state. A cache
 * below a directory the sources never include, such as the default one in
 * `node_modules`, is outside them by the rule the key itself uses
 * (`pluginSourceCovers`).
 *
 * @param caches The plugin cache root and the Go build cache root.
 * @param sources Every source directory the key covers.
 * @throws When a cache lies inside a source, naming both.
 */
function requireCachesOutsideSources(
  caches: readonly string[],
  sources: readonly string[],
): void {
  for (const cache of caches)
    for (const source of sources)
      if (pluginSourceCovers(source, path.resolve(cache), "directory"))
        throw new Error(
          `ttsc: the cache ${cache} lies inside the plugin source ${source}, ` +
            `which the plugin's binary is keyed on, so every build would change ` +
            `the source it was keyed on. Place the cache outside the plugin's ` +
            `sources; the default one, in node_modules, already is.`,
        );
}

/**
 * Require the sources a build compiled to be the ones its key digested.
 *
 * The key reads each source directory before the build, which copies the module
 * and its contributors after any wait for the build lock and reads an overlay
 * or an outside replace target in place for the whole build. A source edited in
 * between is built into the binary, which would then be published, permanently,
 * under the key of the state before the edit, and served once the source
 * returned to it (samchon/ttsc#1505). The copy, or the directory read in place
 * once the build ended, is digested by the rule the key used
 * (`pluginSourceDigest`), and a difference publishes nothing.
 *
 * @param source The directory the key covers.
 * @param compiled What the build compiled from it: its copy, or itself.
 * @throws When the two differ, naming the directory.
 */
function requireKeyedSource(
  source: string,
  compiled: string,
  keyedDigests: ReadonlyMap<string, string>,
  pluginName: string,
): void {
  const keyed = keyedDigests.get(path.resolve(source));
  if (keyed === undefined || pluginSourceDigest(compiled) === keyed) return;
  throw new Error(
    `ttsc: plugin "${pluginName}" source ${source} changed while it was being ` +
      `built, so the binary was not cached under the key of its earlier state. ` +
      `Build again once the edit is complete.`,
  );
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
  const goWork = `use (\n${useLines.join("\n")}\n)${replaceBlock}`;
  fs.writeFileSync(path.join(scratchDir, "go.work"), goWork, "utf8");
  // The Go tool sets the workspace's `go` directive: `go work use` raises it to
  // what every listed module declares. A fixed directive rejects a module that
  // declares a patch release (`go 1.26.0` against `go 1.26`), and a module the
  // selected toolchain is too old for fails here with Go's own error.
  const settled = spawnGoTool(goBinary, ["work", "use"], {
    cwd: scratchDir,
    encoding: "utf8",
    env: GoSourceInputs.goBuildEnv(goBinary, undefined, env),
    windowsHide: true,
  });
  if (settled.error) {
    if ((settled.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(goToolchainNotFoundMessage(pluginName));
    }
    throw new Error(
      `ttsc: setting the Go workspace version for plugin "${pluginName}" failed to spawn ${goBinary}: ${settled.error.message}`,
    );
  }
  if (settled.status !== 0) {
    throw new Error(
      `ttsc: setting the Go workspace version for plugin "${pluginName}" failed:\n${settled.stderr || settled.stdout}`,
    );
  }
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
