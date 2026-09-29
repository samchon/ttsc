import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EmitOwnershipIndex } from "../../compiler/internal/EmitOwnershipIndex";
import { runBuild } from "../../compiler/internal/build/runBuild";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveOwningProjectConfig } from "../../compiler/internal/project/resolveOwningProjectConfig";
import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { SourceBuildCacheLayout } from "../../plugin/internal/source/SourceBuildCacheLayout";
import { resolveSourceBuildCachePaths } from "../../plugin/internal/source/resolveSourceBuildCachePaths";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { buildSingleRootProject } from "./buildSingleRootProject";
import { linkVirtualEntry } from "./linkVirtualEntry";
import { resolveCacheDir } from "./resolveCacheDir";
import { type OwningModuleOptions } from "./runtime/OwningModuleOptions";
import { ProcessOwnedDirectory } from "./runtime/ProcessOwnedDirectory";
import { RuntimeEmitProvenance } from "./runtime/RuntimeEmitProvenance";
import { runtimeRunKey } from "./runtime/runtimeRunKey";
import { withRuntimeDirectoryLock } from "./runtime/withRuntimeDirectoryLock";
import { runtimeCompilerArgs } from "./runtimeCompilerArgs";
import { runtimeEmitProfile } from "./runtimeEmitProfile";

/**
 * Build the owning project and locate the JavaScript emitted from the requested
 * entry for `ttsx`. An entry excluded from that project receives a checked
 * single-entry build inheriting its compiler settings.
 *
 * Discovery uses the caller's spelling while emit ownership uses filesystem
 * identity. The result transfers the process-owned runtime directory to the
 * caller for execution and cleanup. Preparation failure relinquishes it here;
 * successful execution must release it through the runtime directory protocol.
 *
 * Source ownership comes from the completed compiler's output-to-source record;
 * a producer without that record is unsupported for checked execution.
 *
 * @evidence contracts/common.md#principled-implementation Project discovery retains the requested lexical anchor; validated compiler provenance, not a stem or source-map inference, supplies EmitOwnershipIndex with actual output ownership, and an excluded entry uses the supported checked single-root build with its own ledger.
 * @evidence contracts/common.md#clear-and-simple-design Context creation, project compilation, entry fallback and output selection have distinct helpers; one top-level failure boundary cleans the prepared generation before propagating the error.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or malformed producer provenance fails instead of being reconstructed from filenames; the excluded-entry build inherits actual project settings rather than stripping source through a test-only lane.
 * @evidence contracts/common.md#meaningful-documentation Separate native paragraphs explain discovery, cleanup and mandatory producer provenance; result members distinguish relative output-list paths from absolute output-to-source records without property acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Native path/identity helpers separate lexical discovery from physical Node loading; directory locks pin runtime ownership and the virtual layout encodes distinct volume roots without OS-specific shell operations.
 * @evidence contracts/performance.md#efficient-algorithms Each completed build validates its provenance once in O(outputs + contributing sources) entries and retains it for entry lookup and runtime transfer; only a proven-unowned entry receives an additional single-entry build, and mirrored ancestor traversal has an explicit depth/safety boundary.
 * @evidence contracts/performance.md#reuse-equivalent-work One context shares the completed build's validated ledger, output inventory and emit profile with lookup and execution rather than rereading or recomputing producer observations; a fallback replaces the complete emit generation together.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Preparation owns one claimed generation under a pinned cache root; failures relinquish/remove it under the lock, while success transfers cleanupDir and runtimeCacheDir to the caller's execution lifecycle.
 */
export function prepareExecution(
  entryFile: string,
  options: TtscCommonOptions & {
    /** Explicit runtime/plugin cache path relative to the invocation directory. */
    cacheDir?: string;

    /** Explicit project config; absence discovers the entry's owning project. */
    project?: string;

    /** Internal cache key for more than one checked entry in this process. */
    runtimeCacheKey?: string;
  } = {},
): {
  /** Claimed runtime generation whose cleanup ownership transfers to the caller. */
  cleanupDir: string;

  /** Physical directory containing this preparation's emitted output. */
  emitDir: string;

  /** Emitted JavaScript file owned by the requested source entry. */
  entryFile: string;

  /** Physical runtime cache root whose lock serializes this run and clean. */
  runtimeCacheDir: string;

  /** Physical directory holding the run, even when `project` is a link. */
  runtimeRunsDir: string;

  /** The build's record of its outputs, relative to `emitDir`. */
  outputs: readonly string[];

  /** Compiler-observed absolute output paths and their contributing sources. */
  emittedSources: Readonly<Record<string, readonly string[]>>;

  /** Output-specific observed proof failures, without an ownership guarantee. */
  emittedSourceProofFailures?: Readonly<Record<string, string>>;

  /** Physical source-entry spelling used for emit ownership and Node loading. */
  entrySource: string;

  /** Effective project module settings used to classify emitted runtime files. */
  moduleOptions: OwningModuleOptions;

  /** Where the run keeps its lowered orphan sources, under its cache root. */
  orphanCacheDir: string;

  /** Owning project's physical directory. */
  projectRoot: string;

  /** Physical source root whose relative paths are mirrored in the runtime emit. */
  rootDir: string;
} {
  // Two paths, because two different questions are being asked.
  //
  // *Which project compiles this?* is answered from the path the user named.
  // Project discovery walks up from it, so resolving a symlinked entry first
  // would start that walk in the target's tree — finding another project's
  // tsconfig, or none at all.
  //
  // *Where does the compiler put the output, and what does the runtime load?*
  // is answered from the physical path, because that is the spelling Node
  // forces. See `resolveEntrySpelling`.
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const entry = resolveEntrySpelling(cwd, entryFile);
  const context = createProjectContext(
    cwd,
    path.resolve(cwd, entryFile),
    options,
  );
  try {
    buildProject(context, options);
    let emittedEntry = emittedEntryOf(context, entry);
    if (emittedEntry === null) {
      buildEntryProject(context, options, entry);
      emittedEntry = emittedEntryOf(context, entry);
    }
    if (emittedEntry === null) {
      throw new Error(`ttsx: emitted entry not found for ${entryFile}`);
    }
    return {
      cleanupDir: context.processDir,
      emitDir: context.emitDir,
      entryFile: emittedEntry,
      runtimeCacheDir: context.cacheDir,
      runtimeRunsDir: path.dirname(context.processDir),
      entrySource: entry,
      outputs: context.outputs,
      emittedSources: executionProvenance(context),
      emittedSourceProofFailures: context.emittedSourceProofFailures,
      moduleOptions: context.moduleOptions,
      orphanCacheDir: context.orphanCacheDir,
      projectRoot: context.root,
      rootDir: context.runtimeRootDir,
    };
  } catch (error) {
    removeRuntimeOutput(context.processDir, context.cacheDir);
    throw error;
  }
}

/**
 * Maximum number of ancestor directories above the project root that the
 * virtual filesystem overlay mirrors. Three levels covers the common monorepo
 * layout (workspace-root → packages → package-root) so `node_modules` symlinks
 * resolve correctly without reaching an unsafe boundary.
 */
const MAX_VIRTUAL_PARENT_DEPTH = 3;

/**
 * Emit directory of the entry-only fallback build, a sibling of the virtual
 * layout's volume-label directories so it can never collide with a mirrored
 * project path.
 */
const ENTRY_PROJECT_EMIT_DIR = "entry-project";

/**
 * The JavaScript this build proves it emitted from `entry`, or `null` when its
 * complete provenance excludes that source. Missing, incomplete or ambiguous
 * ownership throws instead of being treated as an excluded entry.
 *
 * Only an output proven to come from the entry itself counts. A
 * `scripts/index.ts` outside `include` shares its name with the `src/index.js`
 * the project build emitted, and taking that output would run the wrong program
 * instead of compiling the requested one (samchon/ttsc#1382).
 */
function emittedEntryOf(
  context: ReturnType<typeof createProjectContext>,
  entry: string,
): string | null {
  return new EmitOwnershipIndex({
    emitDir: context.emitDir,
    emittedSources: executionProvenance(context),
    emittedSourceProofFailures: context.emittedSourceProofFailures,
    outputs: context.outputs,
    rootDir: context.runtimeRootDir,
  }).find(entry);
}

/**
 * Compile an entry the whole-project build did not emit, through a project that
 * inherits every option and declares only the entry, then point the context at
 * that build.
 */
function buildEntryProject(
  context: ReturnType<typeof createProjectContext>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
  entry: string,
): void {
  const emitDir = path.join(context.virtualRoot, ENTRY_PROJECT_EMIT_DIR);
  const { rootDir, emittedSources, emittedSourceProofFailures } =
    buildSingleRootProject({
      checked: true,
      emitDir,
      key: context.runtimeCacheKey,
      options: { ...options, cacheDir: context.pluginCacheDir },
      projectRoot: context.root,
      role: "entry",
      source: entry,
      tsconfig: context.tsconfig,
    });
  context.emitDir = emitDir;
  context.emittedSourceProofFailures = emittedSourceProofFailures;
  context.outputs = EmitOwnershipIndex.listOutputs(emitDir);
  context.emittedSources = requireEmitProvenance(
    emittedSources,
    context.tsconfig,
  );
  context.runtimeRootDir = rootDir;
  // Classified by the project itself: the synthesized config only extends it
  // with overrides that do not touch the module format, and it is already
  // removed, so a response file expanded through `--showConfig` could not read
  // it again.
  context.moduleOptions = runtimeEmitProfile(
    context.project,
    options.passthrough,
    options.binary,
  ).moduleOptions;
}

/**
 * The entry in the filesystem's own spelling, symlinked file included.
 *
 * Node is what forces the choice. Without `--preserve-symlinks` it keys a
 * module by its real path, so the runtime hooks identify a served file that way
 * too — and the emit has to be findable under the same name. tsgo does not
 * force anything: it takes `files` verbatim and never resolves them, which is
 * exactly why it must be handed the spelling Node will use rather than a
 * different one.
 *
 * An entry spelled any other way is not a nicer name for the same file. The
 * gate would claim to own an emit the runtime then refuses to serve, and the
 * entry would run through the orphan type-strip lane with the project's
 * transform plugins, `target`, `paths`, and source map all silently dropped —
 * from a run that still prints and still exits zero.
 *
 * Resolving the link can place the entry outside the project, which is the
 * truth rather than a cost: the file genuinely lives there. The project build
 * then does not emit it, and the entry-only build, whose private layout is
 * rooted at the volume, compiles it wherever it lives.
 */
function resolveEntrySpelling(cwd: string, entryFile: string): string {
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  return identities.resolve(path.resolve(cwd, entryFile)).path;
}

/**
 * Directory-safe identity for one prepared runtime. Direct `ttsx` names its
 * directory by this process's run key (`runtimeRunKey`); the public preload
 * supplies a distinct key for every late TypeScript root so one preparation
 * cannot erase another's emit.
 */
function resolveRuntimeCacheKey(runtimeCacheKey: string | undefined): string {
  const key = runtimeCacheKey ?? runtimeRunKey();
  if (!/^[A-Za-z0-9._-]+$/.test(key) || key === "." || key === "..") {
    throw new Error(`ttsx: invalid runtime cache key ${JSON.stringify(key)}`);
  }
  return key;
}

/**
 * Discover the project and acquire a pinned, process-owned runtime generation.
 * Emit profile and source-root observations are shared by the initial project
 * build and any required single-entry fallback.
 *
 * The cache-root identity is fixed before descriptor execution can retarget a
 * lexical alias. Under its directory lock, abandoned generations are swept and
 * this run claims one private layout. The returned context owns it until
 * failure cleanup or successful transfer to the execution caller.
 *
 * @param discoveryFile - The entry as the user named it. Project discovery
 *   walks up from here, so it must not be retargeted through a symlink.
 */
function createProjectContext(
  cwd: string,
  discoveryFile: string,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
) {
  const project = options.project
    ? readProjectConfig({
        cwd,
        projectRoot: options.projectRoot,
        tsconfig: path.resolve(cwd, options.project),
      })
    : discoverOwningProject(cwd, discoveryFile, options);
  const tsconfig = project.path;
  const root = project.root;
  const explicitCacheDir = resolveCacheDir(cwd, options.cacheDir);
  const env = SidecarEnvironment.merge(process.env, options.env);
  const defaultCache =
    explicitCacheDir === undefined
      ? defaultRuntimeCacheDir(root, env)
      : undefined;
  const cacheDirSpelling = explicitCacheDir ?? defaultCache!.runtime;
  const runtimeCacheKey = resolveRuntimeCacheKey(options.runtimeCacheKey);
  // Resolved once: it now costs a realpath (and, for a missing directory on
  // Windows, a case-sensitivity probe) rather than a string join.
  const runtimeRootDir = resolveRuntimeSourceRoot(project, options);
  const emitProfile = runtimeEmitProfile(
    project,
    options.passthrough,
    options.binary,
  );
  fs.mkdirSync(cacheDirSpelling, { recursive: true });
  // Pin the cache parent before deriving a generation path. Descriptors run
  // after this point and may retarget a caller-controlled symlink or junction;
  // every later runtime write and recursive cleanup must remain below the
  // physical parent selected here.
  const cacheDir =
    createFilesystemPathIdentityContext().resolve(cacheDirSpelling).path;
  // The lowered orphan sources outlive the run, so they live in the resolved
  // cache root beside every other persistent part of it, and a default root
  // collects them with the rest (samchon/ttsc#1562).
  const cacheRoot =
    defaultCache === undefined || defaultCache.runtime === defaultCache.root
      ? cacheDir
      : path.dirname(cacheDir);
  if (defaultCache?.collected === true)
    SourceBuildCacheLayout.pruneCacheFiles(cacheRoot);
  // The `project` child can itself be a link. Pin its physical target, sweep
  // abandoned runs, and publish this run's owner in one locked transaction.
  // Clean can never observe a newly selected but still unowned index.
  const { processDir, virtualRoot, emitDir } = withRuntimeDirectoryLock(
    cacheDir,
    () => {
      const directory = path.join(
        cacheDir,
        SourceBuildCacheLayout.RUNTIME_PROJECT_DIRNAME,
      );
      fs.mkdirSync(directory, { recursive: true });
      const runsDir = fs.realpathSync.native(directory);
      const processDir = path.join(runsDir, runtimeCacheKey);
      const virtualRoot = path.join(processDir, "fs");
      const emitDir = project.compilerOptions.outDir
        ? virtualPath(virtualRoot, project.compilerOptions.outDir)
        : virtualPath(virtualRoot, runtimeRootDir);
      ProcessOwnedDirectory.sweep(runsDir);
      fs.rmSync(processDir, { recursive: true, force: true });
      ProcessOwnedDirectory.claim(processDir);
      return { processDir, virtualRoot, emitDir };
    },
  );
  return {
    project,
    tsconfig,
    root,
    cacheDir,
    runtimeCacheKey,
    processDir,
    pluginCacheDir: explicitCacheDir === undefined ? undefined : cacheDir,
    orphanCacheDir: path.join(
      cacheRoot,
      SourceBuildCacheLayout.ORPHAN_CACHE_DIRNAME,
    ),
    virtualRoot,
    emitDir,
    // The source-tree root the emit mirrors (tsgo strips this prefix). Used to
    // map a source `.ts` back to its emitted `.js` when the runtime hooks serve
    // the built entry under its source URL.
    runtimeRootDir,
    // The tsconfig options that decide the emit format, so the runtime hooks
    // classify each served file the same way tsgo chose when emitting it.
    // `target` belongs here as much as `module` does: with `module` absent tsgo
    // derives the module kind from `target`, so publishing only `module` makes
    // the hooks guess. A `--module` forwarded before the entry decides the
    // emit as much as the config does, so both are read.
    moduleOptions: emitProfile.moduleOptions,
    // Force a source map on the transient runtime emit only when the build
    // would carry none — when the project or a forwarded flag already emits
    // `sourceMap` or `inlineSourceMap`, the serve path inlines/absolutizes that
    // map, so no override is needed (issue #353).
    forceRuntimeSourceMap: emitProfile.forceRuntimeSourceMap,
    built: false,
    outputs: [] as readonly string[],
    emittedSourceProofFailures: undefined as
      | Readonly<Record<string, string>>
      | undefined,
    emittedSources: undefined as
      | Readonly<Record<string, readonly string[]>>
      | undefined,
  };
}

/**
 * The project that owns `file`, found the way the language service finds it.
 *
 * The nearest config is where discovery starts, not where it has to stop. A
 * solution-style config (`"files": []` plus `references`) owns nothing itself,
 * and compiling an entry through it applies its empty options to code whose
 * real project sets `experimentalDecorators`, `jsx`, or `paths`
 * (samchon/ttsc#1406). When the nearest config does not contain the file, the
 * referenced project that does is used; an explicit `-P` skips all of this.
 */
function discoverOwningProject(
  cwd: string,
  file: string,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
): ReturnType<typeof readProjectConfig> {
  const nearest = readProjectConfig({
    cwd,
    file,
    projectRoot: options.projectRoot,
  });
  const owning = resolveOwningProjectConfig({
    binary: options.binary,
    file,
    tsconfig: nearest.path,
  });
  return owning === path.resolve(nearest.path)
    ? nearest
    : readProjectConfig({
        cwd,
        projectRoot: options.projectRoot,
        tsconfig: owning,
      });
}

/**
 * The source-tree root the emit mirrors, in the same physical spelling as the
 * entry it will be compared against.
 *
 * Undeclared, the root is the project's own directory, because that is the one
 * tsgo uses: with a config file in play `GetCommonSourceDirectory` answers that
 * file's directory and never computes a common directory of the input files.
 * The entry's directory is not that root — it is only the same directory when
 * the entry happens to sit beside the tsconfig, which is precisely why a
 * `src/`-shaped project mislaid its emit here (issue #1172) while a flat one
 * worked. `installRuntimeHooks.ts::resolveDependencySourceRoot` and
 * `WatchTopology.ts::inferPerSourceCompilerOutputs` already model the same
 * rule, and `TsgoArguments.ts::pinnedRootDirArgs` pins it for tsgo itself.
 *
 * Resolving it is the other half of `resolveEntrySpelling`, and skipping it
 * leaves the comparison mixed rather than merely imprecise. `project.root`
 * arrives through plain `fs.realpathSync`, which resolves reparse points but
 * leaves a Windows 8.3 component alone, while the entry arrives through
 * `fs.realpathSync.native`, which expands it — and `path.relative` folds case
 * but not 8.3. A declared `rootDir` is worse still: it is joined verbatim, so a
 * `rootDir` that is itself a symlinked directory never resolves at all. Either
 * way the gate reads an in-project entry as outside its own root, pays a second
 * whole build for it, and publishes a wider root than the project has.
 *
 * The pass costs nothing in agreement with the root tsgo was pinned to, which
 * stays unresolved on purpose so it matches the spelling tsgo gives the input
 * file names it compares against it. Only the prefix differs between the two;
 * each side strips its own, so the relative path below the root — the part that
 * decides where the emit lands and where the lookup reads — is identical.
 */
function resolveRuntimeSourceRoot(
  project: ReturnType<typeof readProjectConfig>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
): string {
  // A `--rootDir` forwarded before the entry reaches the compiler after the
  // config, so it is the root the outputs are laid out against. Invalid
  // arguments fail the build on their own; the config's root stands until then.
  const effective = readEffectiveCompilerOptions(
    project,
    options.passthrough,
    options.binary,
  )?.("rootDir");
  const rootDir =
    typeof effective === "string" ? effective : project.compilerOptions.rootDir;
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  return identities.resolve(
    typeof rootDir !== "string"
      ? project.root
      : path.isAbsolute(rootDir)
        ? rootDir
        : path.resolve(project.root, rootDir),
  ).path;
}

/**
 * Complete the context's checked project build once, with all compiler output
 * locations confined to its private emit directory.
 *
 * Record emitted files before linking source neighbors, so linked user files
 * cannot masquerade as compiler output. Only a successful build publishes the
 * completed context. Failure releases the claimed generation and preserves the
 * compiler's diagnostic output in the thrown error.
 */
function buildProject(
  context: ReturnType<typeof createProjectContext>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
): void {
  if (context.built) return;

  fs.mkdirSync(path.dirname(context.emitDir), { recursive: true });
  const result = runBuild({
    binary: options.binary,
    checkers: options.checkers,
    cwd: context.root,
    emit: true,
    env: options.env,
    cacheDir: context.pluginCacheDir,
    outDir: context.emitDir,
    // Every output this build writes stays in ttsx's private directory: a
    // declared `declarationDir`, `tsBuildInfoFile`, or `outFile`, and any
    // output location forwarded on the command line, would otherwise land in
    // the user's tree (samchon/ttsc#1404).
    isolateOutputsTo: context.emitDir,
    passthrough: runtimeCompilerArgs(
      context.project,
      options.passthrough,
      options.binary,
    ),
    // `context.emitDir` is ttsx's own temp directory, not an output the project
    // asked for, and tsgo demands an explicit `rootDir` (TS5011) as soon as any
    // `outDir` is in play. Pinning the root tsgo would infer keeps a check-only
    // project runnable without moving its emit (issue #1172); a project that
    // declares `rootDir` is left exactly as it is, which is also the root
    // `resolveRuntimeSourceRoot` published above.
    pinInferredRootDir: true,
    // Emit a source map on the transient entry emit (a PID-isolated temp dir,
    // never the consumer's `outDir`) so the serve path can inline it under the
    // source URL. Routed as a dedicated build option, not a forwarded tsgo
    // flag, so it never reaches a native plugin host's argument parser (issue
    // #353).
    forceRuntimeSourceMap: context.forceRuntimeSourceMap,
    forceEmitProvenance: true,
    pluginConfigDir: options.pluginConfigDir,
    plugins: options.plugins,
    quiet: true,
    resolvedProject: context.project,
    singleThreaded: options.singleThreaded,
    tsconfig: context.tsconfig,
  });
  if (result.status === 0) {
    // Record the build's outputs before the virtual layout links the user's
    // own files in beside them. Without an `outDir` the emit directory is the
    // mirror of the project root, and a `tool.js` linked there from the user's
    // tree would otherwise be recorded as the output of `tool.ts`.
    context.outputs = EmitOwnershipIndex.listOutputs(context.emitDir);
    context.emittedSources = requireEmitProvenance(
      result.emittedSources,
      context.tsconfig,
    );
    context.emittedSourceProofFailures = result.emittedSourceProofFailures;
    linkVirtualProjectLayout(context);
    context.built = true;
    return;
  }

  removeRuntimeOutput(context.processDir, context.cacheDir);
  const detail = [
    `ttsx: project check failed for ${context.tsconfig}`,
    result.stderr || result.stdout,
  ]
    .filter((line) => line.trim().length !== 0)
    .join("\n");
  throw new Error(detail);
}

/**
 * Validate a completed producer's ledger before publishing its runtime context.
 * An empty record is authoritative absence; an omitted or malformed record must
 * not be replaced by source-map or filename inference.
 */
function requireEmitProvenance(
  value: unknown,
  tsconfig: string,
): Readonly<Record<string, readonly string[]>> {
  if (!RuntimeEmitProvenance.isRecord(value)) {
    throw new Error(
      `ttsx: selected emitting producer cannot provide source ownership for ${JSON.stringify(tsconfig)}`,
    );
  }
  return value;
}

/**
 * Read the ledger already validated when this context's build completed.
 * Preparation cannot route or transfer a context whose build never published
 * it.
 */
function executionProvenance(
  context: ReturnType<typeof createProjectContext>,
): Readonly<Record<string, readonly string[]>> {
  if (context.emittedSources === undefined) {
    throw new Error("ttsx: completed emit has no source ownership record");
  }
  return context.emittedSources;
}

/**
 * The runtime cache a run uses when `--cache-dir` names none: the `ttsx` area
 * below the source-plugin cache root selected for the same project and
 * environment, or, when the default workspace-local directory is read-only, one
 * below the system temp directory keyed by the project.
 *
 * Every run writes its output into a directory of its own below the cache and
 * removes it on exit, so any writable parent serves; the workspace-local
 * default keeps related projects together. A `--cache-dir` the user named is
 * never replaced: it is the user's choice, and a failure there is reported.
 */
function defaultRuntimeCacheDir(
  root: string,
  env: NodeJS.ProcessEnv,
): {
  /** Whether ttsc collects the root, which it does for its own default. */
  collected: boolean;

  /** The cache root the runtime directory lives in. */
  root: string;

  /** The runtime's own directory. */
  runtime: string;
} {
  const paths = resolveSourceBuildCachePaths(root, undefined, env);
  const local = path.join(
    paths.root,
    SourceBuildCacheLayout.RUNTIME_CACHE_DIRNAME,
  );
  try {
    if (!env.TTSC_CACHE_DIR) {
      SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(paths.root);
    }
    fs.mkdirSync(local, { recursive: true });
    return {
      collected: !env.TTSC_CACHE_DIR,
      root: paths.root,
      runtime: local,
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (
      env.TTSC_CACHE_DIR ||
      (code !== "EACCES" && code !== "EPERM" && code !== "EROFS")
    ) {
      throw error;
    }
  }
  const fallback = path.join(
    os.tmpdir(),
    "ttsc-ttsx",
    crypto.createHash("sha256").update(root).digest("hex").slice(0, 16),
  );
  return { collected: false, root: fallback, runtime: fallback };
}

/**
 * Relinquish and remove a pinned generation under its runtime-directory lock.
 * Cleanup is best effort during failure handling; a cleanup error must not hide
 * the original compiler or preparation error. Abandoned runs remain
 * discoverable by the process-ownership sweep.
 */
function removeRuntimeOutput(directory: string, runtimeCacheDir: string): void {
  try {
    withRuntimeDirectoryLock(runtimeCacheDir, () => {
      ProcessOwnedDirectory.relinquish(directory);
      fs.rmSync(directory, { recursive: true, force: true });
    });
  } catch {
    // Best effort: cleanup must not hide the original preparation failure.
  }
}

/**
 * Mirror selected project ancestors beside emitted output so native module
 * lookup can reach source neighbors and installed dependencies.
 *
 * Existing virtual entries, including compiler output, win over linked user
 * entries. Each source directory is enumerated once; linkVirtualEntry owns the
 * native file/directory link representation.
 */
function linkVirtualProjectLayout(
  context: ReturnType<typeof createProjectContext>,
): void {
  for (const directory of collectLinkDirectories(context.root)) {
    const virtualDirectory = virtualPath(context.virtualRoot, directory);
    fs.mkdirSync(virtualDirectory, { recursive: true });
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const realEntry = path.join(directory, entry.name);
      const virtualEntry = path.join(virtualDirectory, entry.name);
      if (fs.existsSync(virtualEntry)) {
        continue;
      }
      linkVirtualEntry(realEntry, virtualEntry, entry);
    }
  }
}

/**
 * Walk from `projectRoot` upward (up to `MAX_VIRTUAL_PARENT_DEPTH` steps),
 * stopping early at a workspace root (`pnpm-workspace.yaml` or `.git`). The
 * collected directories are reversed so callers can construct parent layouts
 * before their children. Existing virtual entries win when neighboring source
 * entries are linked, preserving the compiler's own emitted files.
 */
function collectLinkDirectories(projectRoot: string): string[] {
  const out: string[] = [];
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  let current = projectRoot;
  for (let depth = 0; depth <= MAX_VIRTUAL_PARENT_DEPTH; depth += 1) {
    out.push(current);
    if (
      depth > 0 &&
      (fs.existsSync(path.join(current, "pnpm-workspace.yaml")) ||
        fs.existsSync(path.join(current, ".git")))
    ) {
      break;
    }
    const parent = path.dirname(current);
    if (parent === current || isUnsafeVirtualParent(parent, identities)) {
      break;
    }
    current = parent;
  }
  return out.reverse();
}

/**
 * Whether mirroring `directory` would reach a filesystem or temporary root.
 * Identity comparison is required on Windows, where `os.tmpdir()` can carry an
 * 8.3 component while a project created below it is returned in long spelling.
 */
function isUnsafeVirtualParent(
  directory: string,
  identities: ReturnType<typeof createFilesystemPathIdentityContext>,
): boolean {
  const resolved = identities.resolve(directory);
  const root = identities.resolve(path.parse(resolved.path).root);
  const temporaryRoot = identities.resolve(os.tmpdir());
  return resolved.key === root.key || resolved.key === temporaryRoot.key;
}

/**
 * Map an absolute path into a stable, filesystem-safe subtree under `root`.
 *
 * On POSIX the root is always `/`, so every path shares the same prefix —
 * represented here as `"posix"`. On Windows, drive letters and UNC roots each
 * get a full SHA-256 label of their UTF-16 root spelling. This fixed-size
 * native component distinguishes roots such as UNC shares `a-b` and `a_b` under
 * the hash's collision-resistance premise, without punctuation folding or
 * expansion beyond the host's component-length limit. Relative paths remain
 * unchanged.
 */
function virtualPath(root: string, absolute: string): string {
  const parsed = path.parse(path.resolve(absolute));
  const label =
    parsed.root === path.sep
      ? "posix"
      : crypto
          .createHash("sha256")
          .update(parsed.root, "utf16le")
          .digest("hex");
  const relative = path.relative(parsed.root, path.resolve(absolute));
  return path.join(root, label, relative);
}
