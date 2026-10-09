import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { SidecarEnvironment } from "../../../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "../../../internal/E2ETrace";
import { OwnedSynchronousProcess } from "../../../internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../internal/SourceNativeRetirement";
import { createCanonicalTempDirectory } from "../../../internal/createCanonicalTempDirectory";
import { runHoldingLock } from "../../../internal/runHoldingLock";
import { NativeSourcePackages } from "./NativeSourcePackages";
import { SourcePluginWorkspace } from "./SourcePluginWorkspace";
import { GoSourceInputs } from "./GoSourceInputs";
import { GoToolResolution } from "./GoToolResolution";
import type { IPluginModuleReplaceDirectory } from "./IPluginModuleReplaceDirectory";
import type { ITtscBuildContributor } from "./ITtscBuildContributor";
import type { ITtscSourceBuildCachePaths } from "./ITtscSourceBuildCachePaths";
import { PluginBinaryUse } from "./PluginBinaryUse";
import { PluginBuildEnvironmentWitness } from "./PluginBuildEnvironmentWitness";
import type { PluginBuildLockLease } from "./PluginBuildLockLease";
import { PluginBuildLockProtocol } from "./PluginBuildLockProtocol";
import { SourceBuildCacheLayout } from "./SourceBuildCacheLayout";
import type { SourceBuildFilesystemOperations } from "./SourceBuildFilesystemOperations";
import { SourcePluginAdmission } from "./SourcePluginAdmission";
import { acquirePluginBuildLock } from "./acquirePluginBuildLock";
import { computeCacheKey } from "./computeCacheKey";
import { copiesPluginSourceEntry } from "./copiesPluginSourceEntry";
import { createExternalSourceSnapshotLayout } from "./createExternalSourceSnapshotLayout";
import { ensureExecutableGoToolchain } from "./ensureExecutableGoToolchain";
import { pluginModuleReplaceDirectories } from "./pluginModuleReplaceDirectories";
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
 * `opts.env` is the effective environment for this build; the caller merges
 * inherited and constructor layers using native environment-name identity so
 * a programmatic `TtscCompiler` instance
 * can pin its own Go toolchain (`TTSC_GO_BINARY`), Go build cache
 * (`TTSC_GO_CACHE_DIR`), and Go build variables (`GOFLAGS`, `CGO_*`, …) without
 * mutating the shared `process.env`. CLI callers omit it and inherit
 * `process.env`, so ambient behavior is unchanged.
 *
 * The cache key includes source and toolchain readings. Before publication the
 * scratch inputs are compared with their recorded digests and the external
 * toolchain witness is checked. Caller-supplied digests must describe the
 * intended inputs; metadata-based witnesses and sequential observations do not
 * pin files against concurrent changes. Detected differences fail publication.
 * A changed toolchain discards the owned attempt, then takes a new reading and
 * executes or admits under its new key, for at most three epochs. Source
 * readings and request variables stay fixed; native, source and cleanup
 * failures do not retry. Only the successful epoch publishes caller digests.
 * The Go-owned object cache retains Go's tool/action identity semantics; these
 * attempts discard ttsc's failed binary and scratch, not Go's object entries.
 * Optional loader-required package ownership enters the key. Its cold producer
 * admits the entry and linked sources through Go metadata in the actual
 * materialized workspace before compilation; legacy cache artifacts have a
 * different key. Existing binary hits trust the cache producer and key rather than rehashing
 * executable bytes. Default caches are managed locally, while explicit roots
 * retain caller-managed pruning policy. Every returned cache key registers a
 * reader token retained by this process until exit; registration shares the
 * builder/collector lease, and other consumers register independent readers.
 * Failure to establish ownership propagates. Private opt-in tracing records the
 * mandatory key-creation and pre-build witness gates and adds one diagnostic
 * observation after Go returns. That diagnostic read adds metadata work, not
 * publication permission. A discarded epoch is separately recorded when the
 * bounded build owner starts again.
 *
 * Explicit worker scopes check cancellation between build phases, copied source
 * entries and native commands, including reader admission and final
 * publication. Observed cancellation releases held leases and scratch without
 * starting a new post-build maintenance pass. Native calls and delegated
 * hashing can delay observation; these checkpoints do not impose a hard
 * execution deadline.
 *
 * @evidence contracts/common.md#principled-implementation Each of at most three toolchain epochs compares materialized source digests and checks its own pre-read witness before build, publication or cache adoption. A changed epoch publishes nothing and starts again only after its scratch and key lease finish; first source readings and request variables remain fixed. Caller digest maps receive only successful authority. Opted-in cancellation guards stage, copy-entry, native-command, reader and publication admission, while cleanup still finishes. Metadata observations are not an atomic snapshot, and existing executable bytes remain trusted cache-producer output.
 * @evidence contracts/common.md#clear-and-simple-design One owner sequences target resolution, key creation, cache selection and fenced build coordination; private helpers own scratch materialization, Go workspace semantics and publication cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A changed witness is never overwritten or accepted. A fresh epoch takes a new toolchain reading and performs the actual build or qualified adoption; source, native and cleanup failures stay terminal. No selected SDK tool is warmed by a special command, and no foreign environment or memo is rebased. Shared Go objects retain their owner's toolID/actionID contract; same-version custom tool semantics beyond that contract are not newly guaranteed.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain effective environment, recorded-input comparisons and their trust/observation limits, reader registration and managed versus explicit roots; option-map comments state their reading provenance with blank member separation.
 * @evidence contracts/portability.md#os-neutral-implementation Node path/physical-cache/temp APIs preserve native identities; executable resolution and Windows command handling are isolated owners, and the binary filename explicitly follows its executable platform.
 * @evidence contracts/performance.md#efficient-algorithms At most three epochs redo native toolchain observation, key construction, materialization and guarded admission; each can run one Go build, preceded by one batched package metadata command when the loader requires ownership admission. The shared compiler reader can itself make three version observations, hence at most nine such cold observations for a persistently moving compiler and no build when its key witness fails. Full-file bytes, entries, path/sort text, contributors, external trees and witness populations drive work. Scoped cancellation is sampled between phases/entries/commands and does not bound native calls or delegated hashing. First source digest readings are reused across epochs, while each scratch is independently checked. Existing lock contention has its separate wait budget and native Go compiler work remains delegated.
 * @evidence contracts/performance.md#reuse-equivalent-work Existing binaries and concurrent builders share the version/platform/source/environment key with reader admission before return, assuming trustworthy cache producers and supplied digest maps. Fixed trimpath compilation removes disposable snapshot paths from Go object identities. Shared load readings and sequential source/toolchain comparisons reject observed changes; metadata reuse and unobserved concurrent mutation remain the underlying witnesses' limits.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Scratch directories and build/cache leases have finally-based cleanup, including cancellation; cancelled work admits no new post-build prune pass. Scratch removal or lease cleanup can fail, and selected synchronous child settlement does not join arbitrary descendants. Repeated commands can repeat external tool effects; only ttsc-owned failed outputs are discarded, and Go-owned object entries retain their existing lifetime. Pending binary cleanup is best-effort. Reader tokens and their process map grow with distinct physical keys until process exit. Managed pruning attempts age/LRU reclamation while protecting live, unknown and selected entries, so it is not a hard disk bound; explicit roots remain caller-managed.
 */
export function buildSourcePlugin(opts: {
  source: string;
  pluginName: string;
  baseDir: string;
  cacheDir?: string;
  contributors?: readonly ITtscBuildContributor[];
  env?: NodeJS.ProcessEnv;

  /** Loader-required ownership of the entry and named linked packages. */
  packageOwnership?: readonly { entry: string; kind: "executable" | "linked" }[];

  /**
   * Digests of the environment each build directory is keyed on, shared by
   * every build of the load and filled with this build's (`computeCacheKey`),
   * so the load reports its plugin sources' states from the same reading.
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
   * built from.
   */
  sourceDigests?: Map<string, string>;

  ttscVersion: string;
  tsgoVersion: string;
}): string {
  OwnedSynchronousProcess.checkpoint();
  const env = SidecarEnvironment.merge(opts.env ?? process.env);
  // Source authority belongs to the request, not to a discarded toolchain
  // epoch. Keep its first readings even when the toolchain is read again.
  const sourceDigests = new Map(opts.sourceDigests);
  for (let attempt = 0; ; attempt += 1) {
    OwnedSynchronousProcess.checkpoint();
    const environmentDigests = new Map(opts.environmentDigests);
    try {
      const binary = buildSourcePluginAttempt(
        opts,
        env,
        sourceDigests,
        environmentDigests,
      );
      OwnedSynchronousProcess.checkpoint();
      for (const [directory, digest] of sourceDigests)
        opts.sourceDigests?.set(directory, digest);
      for (const [directory, digest] of environmentDigests)
        opts.environmentDigests?.set(directory, digest);
      return binary;
    } catch (error) {
      if (
        !(error instanceof PluginBuildEnvironmentChangedError) ||
        !error.retryable ||
        attempt === 2
      )
        throw error;
      E2ETrace.capabilityResolution(
        "plugin-build-environment-epoch-discarded",
        {
          pluginName: opts.pluginName,
          attempt: attempt + 1,
        },
      );
    }
  }
}

/** One fresh toolchain reading and its guarded cache admission or build. */
function buildSourcePluginAttempt(
  opts: Parameters<typeof buildSourcePlugin>[0],
  env: NodeJS.ProcessEnv,
  sourceDigests: Map<string, string>,
  environmentDigests: Map<string, string>,
): string {
  OwnedSynchronousProcess.checkpoint();
  const { dir, entry, source } = resolveSourceBuildTarget(opts);
  const overlayDirs = [...(opts.overlayDirs ?? SourcePluginWorkspace.findTtscOverlayDirs())].sort();
  const contributors = opts.contributors ?? [];
  const compiler = resolveGoCompiler(env);
  const goBinary = GoToolResolution.resolveGoToolForBuild(
    compiler.binary,
    env,
    dir,
  );
  ensureExecutableGoToolchain(goBinary, compiler.bundled);
  OwnedSynchronousProcess.checkpoint();
  // The digest of every directory the key covers, as the key read it, which
  // the build proves against what it compiled.
  const environmentWitness: PluginBuildEnvironmentWitness.Record = new Map();
  const key = computeCacheKey({
    contributors,
    packageOwnership: opts.packageOwnership,
    dir,
    entry,
    env,
    environmentWitness,
    filesystem: opts.filesystem,
    goBinary,
    overlayDirs,
    environmentDigests,
    sourceDigests,
    ttscVersion: opts.ttscVersion,
    tsgoVersion: opts.tsgoVersion,
  });
  OwnedSynchronousProcess.checkpoint();
  const unchanged = PluginBuildEnvironmentWitness.holds(
    environmentWitness,
    "key-created",
  );
  if (process.env.TTSC_E2E_TRACE) {
    E2ETrace.capabilityResolution("plugin-build-environment-key-created", {
      pluginName: opts.pluginName,
      goBinary,
      key,
      dir,
      entry,
      sourceDigestsJson: JSON.stringify(Object.fromEntries(sourceDigests)),
      overlayDirsJson: JSON.stringify(overlayDirs),
      contributorNamesJson: JSON.stringify(
        contributors.map((contributor) => contributor.name),
      ),
      unchanged,
    });
  }
  if (!unchanged) throw pluginBuildEnvironmentChanged(opts.pluginName);
  OwnedSynchronousProcess.checkpoint();
  const paths = resolveSourceBuildCachePaths(opts.baseDir, opts.cacheDir, env);
  SourcePluginAdmission.requireCachesOutsideSources(
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
  OwnedSynchronousProcess.checkpoint();
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
  const retirementRoot = PluginBuildLockProtocol.pluginBuildLockProtocolDir(
    `${cacheDir}.lock`,
  );
  SourceNativeRetirement.assertAvailable(retirementRoot);
  OwnedSynchronousProcess.checkpoint();
  if (
    !SourceNativeRetirement.isProtected(retirementRoot) &&
    fs.existsSync(binaryPath) &&
    PluginBinaryUse.holds(cacheDir)
  ) {
    requireBuildEnvironment(environmentWitness, opts.pluginName, "cache-hit");
    OwnedSynchronousProcess.checkpoint();
    E2ETrace.capabilityResolution("plugin-build-cache-admission", {
      pluginName: opts.pluginName,
      key,
      cacheDir,
      binaryPath,
      outcome: "held-binary",
    });
    touchCacheEntry(cacheDir);
    return binaryPath;
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  const label = opts.label ?? "source plugin";
  const quiet = opts.quiet === true;
  let compiled = false;
  const built = buildUnderPluginLock(
    cacheDir,
    binaryPath,
    {
      label,
      pluginName: opts.pluginName,
      quiet,
    },
    () =>
      requireBuildEnvironment(
        environmentWitness,
        opts.pluginName,
        "lock-adoption",
      ),
    () => {
      OwnedSynchronousProcess.checkpoint();
      compiled = true;
      E2ETrace.capabilityResolution("plugin-build-cache-admission", {
        pluginName: opts.pluginName,
        key,
        cacheDir,
        binaryPath,
        outcome: "compile-owned",
      });
      // GC owns the same key lease before deleting a binary entry. It may have
      // removed this directory before acquisition, so recreate and validate it
      // only after this build has entered its protected publication interval.
      if (managePluginCache) canonicalPluginCacheEntry(pluginRoot, key);
      else fs.mkdirSync(cacheDir, { recursive: true });
      return compileSourcePlugin({
        binaryPath,
        cacheDir,
        contributors,
        packageOwnership: opts.packageOwnership,
        dir,
        entry,
        env,
        environmentWitness,
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
      });
    },
  );
  OwnedSynchronousProcess.checkpoint();
  E2ETrace.capabilityResolution("plugin-build-cache-admission", {
    pluginName: opts.pluginName,
    key,
    cacheDir,
    binaryPath,
    outcome: compiled ? "compile-returned" : "lock-adopted",
  });
  if (managePluginCache) {
    // The pre-build daily pass cannot account for the binary this cold build
    // just published. Attempt size-policy maintenance after publication, once this
    // process has released its per-key build lock.
    OwnedSynchronousProcess.checkpoint();
    prunePluginCacheRoot(pluginRoot, {
      force: true,
      protectedEntries: [cacheDir],
    });
  }
  return built;
}

/**
 * A rejected toolchain epoch whose owned build can be attempted again only
 * after cleanup. Other failures never acquire this retry authority.
 *
 * The subtype separates strict witness failure from source, native compiler and
 * filesystem failures. It does not authorize reuse of changed output; cleanup
 * can revoke retry permission without replacing the original error. Native
 * observation remains with witness and cleanup owners, and the build owner
 * chooses the bounded algorithm and owns this call-local error.
 */
class PluginBuildEnvironmentChangedError extends Error {
  /** A cleanup failure revokes permission to start another epoch. */
  retryable = true;
}

function pluginBuildEnvironmentChanged(
  pluginName: string,
): PluginBuildEnvironmentChangedError {
  return new PluginBuildEnvironmentChangedError(
    `ttsc: the Go toolchain of plugin "${pluginName}" changed while it ` +
      `was being built, so the binary was not cached under the key of its ` +
      `earlier toolchain. Build again once the change is complete.`,
  );
}

function requireBuildEnvironment(
  witness: PluginBuildEnvironmentWitness.Record,
  pluginName: string,
  observation: string,
): void {
  if (!PluginBuildEnvironmentWitness.holds(witness, observation))
    throw pluginBuildEnvironmentChanged(pluginName);
}

const CONTRIBUTIONS_FILE_NAME = "ttsc_contributions.go";

const CONTRIB_DIRNAME = "contrib";

/** Run the actual `go build` and publish the binary; assumes the lock is held. */
function compileSourcePlugin(opts: {
  binaryPath: string;
  cacheDir: string;
  contributors: readonly ITtscBuildContributor[];
  packageOwnership?: readonly { entry: string; kind: "executable" | "linked" }[];
  dir: string;
  entry: string;
  env: NodeJS.ProcessEnv;

  /** The toolchain paths the key read, with their metadata at that read. */
  environmentWitness: PluginBuildEnvironmentWitness.Record;

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
  OwnedSynchronousProcess.checkpoint();
  if (!opts.quiet) {
    const extra =
      opts.contributors.length === 0
        ? ""
        : ` + ${opts.contributors.length} contributor(s): ${opts.contributors
            .map((c) => c.name)
            .join(", ")}`;
    process.stderr.write(
      `ttsc: building ${opts.label} "${opts.pluginName}" from ${opts.source}${extra} ` +
        `(a cold Go cache can take several minutes) ` +
        `See https://ttsc.dev/docs/ttsc/compile#plugin-cache to persist it across builds.\n`,
    );
  }

  const scratchDir = createCanonicalTempDirectory(`ttsc-plugin-${opts.key}-`);
  let taskFailure: { error: unknown } | undefined;
  try {
    SourceNativeRetirement.register({
      fenceRoot: scratchDir,
      retainedPaths: [scratchDir],
    });
    SourceNativeRetirement.register({
      fenceRoot: opts.cacheDir,
      retainedPaths: [opts.cacheDir],
    });
    SourceNativeRetirement.register({
      fenceRoot: PluginBuildLockProtocol.pluginBuildLockProtocolDir(
        `${opts.cacheDir}.lock`,
      ),
      retainedPaths: [scratchDir, opts.cacheDir, opts.goBuildCacheRoot],
    });
    OwnedSynchronousProcess.checkpoint();
    SourcePluginWorkspace.materialize(opts.dir, scratchDir);
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
    OwnedSynchronousProcess.checkpoint();
    // Every source the build would otherwise read in place, an overlay and
    // each replace target outside the module, is copied and proven against the
    // key before Go reads it, as the module and its contributors are: a check
    // after the build cannot tell a source that held still from one that
    // changed and changed back while Go was reading it.
    const external = snapshotExternalSources(
      scratchDir,
      [
        ...opts.overlayDirs,
        ...replacements.map((replacement) => replacement.directory),
      ],
      opts.keyedDigests,
      opts.pluginName,
    );
    OwnedSynchronousProcess.checkpoint();
    anchorReplaceDirectories(
      replacements.map((replacement) => ({
        ...replacement,
        directory: external.get(path.resolve(replacement.directory))!,
      })),
      scratchDir,
      opts.goBinary,
      opts.env,
    );
    const goModReader = SourcePluginWorkspace.createGoModReader(
      opts.goBinary,
      opts.pluginName,
      opts.env,
    );
    OwnedSynchronousProcess.checkpoint();
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
    SourcePluginWorkspace.writeGoWork(
      scratchDir,
      opts.overlayDirs.map(
        (directory) => external.get(path.resolve(directory))!,
      ),
      opts.goBinary,
      opts.pluginName,
      opts.env,
      goModReader,
    );
    OwnedSynchronousProcess.checkpoint();
    const scratchBinaryName =
      process.platform === "win32" ? ".ttsc-plugin.exe" : ".ttsc-plugin";
    let attemptedGoBuildCacheRoot: string | undefined;
    try {
      withGoBuildCacheLease(
        opts.goBuildCacheRoot,
        opts.manageGoBuildCache,
        (goBuildCacheRoot) => {
          OwnedSynchronousProcess.checkpoint();
          attemptedGoBuildCacheRoot = goBuildCacheRoot;
          requireBuildEnvironment(
            opts.environmentWitness,
            opts.pluginName,
            "go-starting",
          );
          if (process.env.TTSC_E2E_TRACE) {
            E2ETrace.capabilityResolution(
              "plugin-build-environment-go-starting",
              {
                pluginName: opts.pluginName,
                goBinary: opts.goBinary,
                unchanged: true,
              },
            );
          }
          if (opts.packageOwnership !== undefined) {
            const observations = NativeSourcePackages.read({
              cwd: scratchDir,
              entries: opts.packageOwnership.map((input) => input.entry),
              env: GoSourceInputs.goBuildEnv(opts.goBinary, goBuildCacheRoot, opts.env),
              goBinary: opts.goBinary,
              pluginName: opts.pluginName,
            });
            opts.packageOwnership.forEach((input, index) => {
              NativeSourcePackages.kind(observations[index]!, `${opts.pluginName} ${input.entry}`, input.kind);
            });
          }
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
          OwnedSynchronousProcess.checkpoint();
          if (process.env.TTSC_E2E_TRACE) {
            E2ETrace.capabilityResolution(
              "plugin-build-environment-go-returned",
              {
                pluginName: opts.pluginName,
                goBinary: opts.goBinary,
                unchanged: PluginBuildEnvironmentWitness.holds(
                  opts.environmentWitness,
                  "go-returned",
                ),
              },
            );
          }
        },
      );
    } finally {
      if (
        !OwnedSynchronousProcess.cancelled() &&
        SourceNativeRetirement.canRelease() &&
        opts.manageGoBuildCache &&
        attemptedGoBuildCacheRoot !== undefined
      ) {
        // The daily pre-build pass cannot see objects the build is about to
        // add, including objects left behind by a failed compile. Enforce the
        // size policy after every actual cold-build attempt so churn cannot
        // grow the cache unchecked behind a fresh daily marker. Cancellation
        // still releases the lease and scratch, but admits no new maintenance.
        pruneGoBuildCacheRoot(attemptedGoBuildCacheRoot, { force: true });
      }
    }
    // The toolchain was read for the key before the lock wait and the build,
    // and Go ran it by path. Every path the key's environment read must still
    // hold the metadata it was read with, or the binary may be another
    // toolchain's. Change time also detects reverted writes when native
    // metadata distinguishes those edits; the witness
    // documents that premise rather than certifying a second byte comparison.
    if (
      !PluginBuildEnvironmentWitness.holds(
        opts.environmentWitness,
        "publication",
      )
    ) {
      E2ETrace.capabilityResolution(
        "plugin-build-environment-publication-refused",
        {
          pluginName: opts.pluginName,
          goBinary: opts.goBinary,
          GOTOOLCHAIN: opts.env?.GOTOOLCHAIN,
          GOROOT: opts.env?.GOROOT,
          GOENV: opts.env?.GOENV,
          GOFLAGS: opts.env?.GOFLAGS,
          CGO_ENABLED: opts.env?.CGO_ENABLED,
          CC: opts.env?.CC,
          CXX: opts.env?.CXX,
        },
      );
      throw pluginBuildEnvironmentChanged(opts.pluginName);
    }
    const builtBinary = path.join(scratchDir, scratchBinaryName);
    OwnedSynchronousProcess.checkpoint();
    publishBuiltBinary(builtBinary, opts.binaryPath);
    touchCacheEntry(opts.cacheDir);
    return opts.binaryPath;
  } catch (error) {
    taskFailure = { error };
    throw error;
  } finally {
    SourceNativeRetirement.releaseResource(scratchDir, () => {
      fs.rmSync(scratchDir, { recursive: true, force: true });
      SourceNativeRetirement.forget(opts.cacheDir);
    }, taskFailure);
  }
}

/**
 * Build a source plugin while holding an exclusive cross-process lock for its
 * cache key, so concurrent fan-out (parallel suites, a benchmark, a worker
 * pool) shares a successful publication instead of building once per process. A
 * discarded transaction can rebuild under the same content key after a fresh
 * reading; the lock serializes each attempt rather than promising one build for
 * the key's entire lifetime.
 *
 * `<cacheDir>.lock.v3` is a persistent coordination directory. The adjacent
 * legacy `.lock` and older `.lock.v2` paths are separate namespaces: an old
 * holder or reclaimer cannot remove a v3 successor. A contender writes a
 * non-empty candidate and atomically renames it to `current`; only one rename
 * wins. The winner builds and publishes while every loser polls and reuses the
 * resulting binary. A loser distinguishes two ways a generation stops
 * blocking:
 *
 * - `released`: the holder retired `current` itself — it published, or its build
 *   threw and its `finally` freed the key. The loser simply retries the
 *   ordinary acquisition; nothing is stale and nothing is reported.
 * - `abandoned`: `current` still exists but its qualified same-host owner is
 *   provably absent. Unknown metadata is inconclusive regardless of its age.
 *   Only an actual abandonment observation permits retirement of that
 *   generation. One monotonic admission budget covers every retry; expiration
 *   throws without retiring a live or inconclusive owner.
 *
 * Retired generations remain as non-empty tombstones while their holder or
 * registered observers may still use the corresponding lease/fence. Release and
 * reclaim both rename `current` to the observed generation's deterministic
 * tombstone path. Once generation A is retired, a stale observer or old
 * finalizer for A cannot rename successor B there because replacing the
 * non-empty tombstone fails atomically. Pruning must prove the holder and every
 * recorded observer gone before removing that history. The persistent root
 * itself is retained, and `publishBuiltBinary`'s atomic rename remains defense
 * in depth.
 */
function buildUnderPluginLock(
  cacheDir: string,
  binaryPath: string,
  lockInfo: {
    label: string;
    pluginName: string;
    quiet: boolean;
  },
  validateAdoption: () => void,
  build: () => string,
): string {
  const lockDir = `${cacheDir}.lock`;
  const retirementRoot =
    PluginBuildLockProtocol.pluginBuildLockProtocolDir(lockDir);
  const startedAt = performance.now();
  for (;;) {
    OwnedSynchronousProcess.checkpoint();
    SourceNativeRetirement.assertAvailable(retirementRoot);
    if (
      !SourceNativeRetirement.isProtected(retirementRoot) &&
      fs.existsSync(binaryPath) &&
      PluginBinaryUse.holds(cacheDir)
    ) {
      validateAdoption();
      OwnedSynchronousProcess.checkpoint();
      touchCacheEntry(cacheDir);
      return binaryPath;
    }
    const remaining =
      PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_WAIT_MS -
      (performance.now() - startedAt);
    if (remaining <= 0) {
      throw new Error(
        `ttsc: timed out waiting for ${lockInfo.label} "${lockInfo.pluginName}" ` +
          `at ${lockDir}; no active generation was retired` +
          (SourceNativeRetirement.describeProtection(retirementRoot) ?? ""),
      );
    }
    let lease: PluginBuildLockLease | null;
    // Registration must serialize with the public collector even when its
    // scheduling is caller-managed. A failed ownership primitive cannot
    // safely return a pathname that another collector may remove.
    lease = acquirePluginBuildLock(lockDir);
    if (lease === null) {
      const waited = waitForPluginBinary({
        binaryPath,
        lockDir,
        lockInfo,
        timeoutMs: Math.max(
          0,
          PluginBuildLockProtocol.PLUGIN_BUILD_LOCK_WAIT_MS -
            (performance.now() - startedAt),
        ),
      });
      if (waited.outcome === "published") {
        // Publication is not reader admission: reacquire the key to register
        // this consumer before returning the shared executable pathname.
        OwnedSynchronousProcess.sleep(Math.min(10, remaining));
        continue;
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
      // routine handoff as abandonment.
      continue;
    }
    const held = lease;
    let buildFailure: unknown;
    return runHoldingLock(
      () => {
        try {
          OwnedSynchronousProcess.checkpoint();
          // Re-check under the lock: a previous holder may have just published.
          if (fs.existsSync(binaryPath)) {
            validateAdoption();
            OwnedSynchronousProcess.checkpoint();
            PluginBinaryUse.retain(cacheDir);
            touchCacheEntry(cacheDir);
            return binaryPath;
          }
          const binary = build();
          OwnedSynchronousProcess.checkpoint();
          PluginBinaryUse.retain(cacheDir);
          return binary;
        } catch (error) {
          buildFailure = error;
          throw error;
        }
      },
      () => releasePluginBuildLock(lockDir, held),
      (error) => {
        if (buildFailure instanceof PluginBuildEnvironmentChangedError)
          buildFailure.retryable = false;
        reportPluginLockRelease(lockDir, lockInfo, error);
      },
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
    `ttsc: could not finish cleanup for the ${lockInfo.label} "${lockInfo.pluginName}" ` +
      `cache lock at ${lockDir} (${error instanceof Error ? error.message : String(error)}); ` +
      `unconfirmed ownership or completion may defer later cache work\n`,
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
 *   rules and the host's dependency declarations govern module resolution. This
 *   is a module-ownership rule, not a sandbox preventing arbitrary imports or
 *   proving dependency content from the manifest alone.
 */
function mergeContributors(opts: {
  contributors: readonly ITtscBuildContributor[];
  entry: string;
  goModReader: SourcePluginWorkspace.GoModReader;
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
    OwnedSynchronousProcess.checkpoint();
    SourcePluginAdmission.requireContributorPackage(
      opts.pluginName,
      contributor,
    );
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
  OwnedSynchronousProcess.checkpoint();
  const pending = `${binaryPath}.${process.pid}.${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}.tmp`;
  try {
    fs.copyFileSync(builtBinary, pending);
    if (process.platform !== "win32") {
      fs.chmodSync(pending, 0o755);
    }
    try {
      OwnedSynchronousProcess.checkpoint();
      fs.renameSync(pending, binaryPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (
        (code === "EEXIST" || code === "EPERM" || code === "EACCES") &&
        fs.existsSync(binaryPath)
      ) {
        return;
      }
      throw error;
    }
  } finally {
    // Copy and permission failures can leave the same pending entry as a
    // failed rename. Cleanup is best-effort so it preserves the build error.
    try {
      fs.rmSync(pending, { force: true });
    } catch {}
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


/**
 * The path, below a build's scratch directory, of the tree holding its copies
 * of the sources outside the module.
 */
const EXTERNAL_SOURCES_DIRECTORY = path.join(".ttsc", "external");

/**
 * Copy each source directory outside the module into the scratch directory and
 * prove the copy against the key's digest, returning each copy by the directory
 * it was taken from.
 *
 * The copies translate each volume's common source ancestor below one root,
 * omitting unrelated absolute ancestry that can exceed a native cwd limit.
 * Uniform translation preserves relative paths between two of them, such as a
 * driver's `replace` of the shims beside it, still names the copy of what it
 * named. A directory below another is copied with it and again on its own path,
 * which is the same place.
 */
function snapshotExternalSources(
  scratchDir: string,
  directories: readonly string[],
  keyedDigests: ReadonlyMap<string, string>,
  pluginName: string,
): Map<string, string> {
  const root = path.join(scratchDir, EXTERNAL_SOURCES_DIRECTORY);
  const copies = createExternalSourceSnapshotLayout(root, directories);
  for (const [directory, copy] of copies) {
    OwnedSynchronousProcess.checkpoint();
    SourcePluginWorkspace.materialize(directory, copy);
    requireKeyedSource(directory, copy, keyedDigests, pluginName);
  }
  return copies;
}

/**
 * Point every `replace` target outside the module at the build's copy of it.
 *
 * The build runs in a scratch copy of the module, where `../dep` names a
 * sibling of the copy instead of the module's sibling that `go build` in the
 * module compiles, and an absolute target would be read in place. The copy's
 * `go.mod` is rewritten to the absolute directory of the proven copy through
 * `go mod edit`, Go's own editor of the file. A target inside the module moved
 * with the copy and is left as it is.
 */
function anchorReplaceDirectories(
  replacements: readonly IPluginModuleReplaceDirectory[],
  scratchDir: string,
  goBinary: string,
  env: NodeJS.ProcessEnv,
): void {
  for (const replacement of replacements) {
    OwnedSynchronousProcess.checkpoint();
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
    OwnedSynchronousProcess.checkpoint();
    if (result.error !== undefined || result.status !== 0)
      throw new Error(
        `ttsc: anchoring the replacement of ${old} failed: ${
          result.error?.message ?? (result.stderr || result.stdout)
        }`,
      );
  }
}

/**
 * Require the sources a build compiled to be the ones its key digested.
 *
 * The key reads each source directory before the build, which copies the module
 * and its contributors after any wait for the build lock and snapshots overlays
 * and outside replace targets before Go starts. A source edited in between is
 * built into the binary, which would then be published, permanently, under the
 * key of the state before the edit, and served once the source returned to it.
 * The copy is digested by the rule the key used (`pluginSourceDigest`), and a
 * difference publishes nothing.
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
  OwnedSynchronousProcess.checkpoint();
  const keyed = keyedDigests.get(path.resolve(source));
  if (keyed === undefined || pluginSourceDigest(compiled) === keyed) return;
  throw new Error(
    `ttsc: plugin "${pluginName}" source ${source} changed while it was being ` +
      `built, so the binary was not cached under the key of its earlier state. ` +
      `Build again once the edit is complete.`,
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
  OwnedSynchronousProcess.checkpoint();
  ensureExecutableGoToolchain(goBinary, normalizeGoToolPermissions);
  const result = spawnGoTool(
    goBinary,
    ["build", ...GoSourceInputs.BUILD_FLAGS, "-o", binaryName, entry],
    {
      cwd,
      encoding: "utf8",
      env: GoSourceInputs.goBuildEnv(goBinary, goBuildCacheRoot, env),
      windowsHide: true,
    },
  );
  OwnedSynchronousProcess.checkpoint();
  if (result.error) {
    throw new Error(
      SourcePluginWorkspace.goSpawnFailureMessage(
        `building plugin "${pluginName}"`,
        pluginName,
        goBinary,
        cwd,
        result.error,
      ),
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `ttsc: building plugin "${pluginName}" via "go build" failed:\n${result.stderr || result.stdout}`,
    );
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
