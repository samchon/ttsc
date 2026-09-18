import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EmitOwnershipIndex } from "../../compiler/internal/EmitOwnershipIndex";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import { runBuild } from "../../compiler/internal/build/runBuild";
import { createFilesystemPathIdentityContext } from "../../internal/pathIdentity/createFilesystemPathIdentityContext";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { runtimeCompilerArgs } from "./runtimeCompilerArgs";
import { type OwningModuleOptions } from "./runtime/OwningModuleOptions";
import { projectModuleOptions } from "./runtime/projectModuleOptions";
import { buildSingleRootProject } from "./buildSingleRootProject";
import { linkVirtualEntry } from "./linkVirtualEntry";

/** Build the owning project and locate the emitted JavaScript entry for `ttsx`. */
export function prepareExecution(
  entryFile: string,
  options: TtscCommonOptions & {
    cacheDir?: string;
    project?: string;
    /** Internal cache key for more than one checked entry in this process. */
    runtimeCacheKey?: string;
  } = {},
): {
  cleanupDir: string;
  emitDir: string;
  entryFile: string;
  /** The build's record of its outputs, relative to `emitDir`. */
  outputs: readonly string[];
  entrySource: string;
  moduleOptions: OwningModuleOptions;
  projectRoot: string;
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
      entrySource: entry,
      outputs: context.outputs,
      moduleOptions: context.moduleOptions,
      projectRoot: context.root,
      rootDir: context.runtimeRootDir,
    };
  } catch (error) {
    removeRuntimeOutput(context.processDir);
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
 * The JavaScript this build emitted from `entry`, or `null` when it emitted
 * none — which is the signal that the entry sits outside the project's file
 * set.
 *
 * Only an output proven to come from the entry itself counts. A
 * `scripts/index.ts` outside `include` shares its name with the
 * `src/index.js` the project build emitted, and taking that output would run
 * the wrong program instead of compiling the requested one (samchon/ttsc#1382).
 */
function emittedEntryOf(
  context: ReturnType<typeof createProjectContext>,
  entry: string,
): string | null {
  return new EmitOwnershipIndex({
    emitDir: context.emitDir,
    outputs: context.outputs,
    rootDir: context.runtimeRootDir,
  }).find(entry);
}

/**
 * Compile an entry the whole-project build did not emit, through a project
 * that inherits every option and declares only the entry, then point the
 * context at that build.
 */
function buildEntryProject(
  context: ReturnType<typeof createProjectContext>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
  entry: string,
): void {
  const emitDir = path.join(context.virtualRoot, ENTRY_PROJECT_EMIT_DIR);
  const { project, rootDir } = buildSingleRootProject({
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
  context.outputs = EmitOwnershipIndex.listOutputs(emitDir);
  context.runtimeRootDir = rootDir;
  context.moduleOptions = projectModuleOptions(project.compilerOptions);
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
 * Resolving the link widens `rootDir` to the ancestor the two trees share,
 * which is not a cost but the requirement: the file genuinely lives outside the
 * project, and no root that excludes it can compile it.
 */
function resolveEntrySpelling(cwd: string, entryFile: string): string {
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  return identities.resolve(path.resolve(cwd, entryFile)).path;
}

/**
 * Directory-safe identity for one prepared runtime. Direct `ttsx` retains its
 * historical PID directory; the public preload supplies a distinct key for
 * every late TypeScript root so one preparation cannot erase another's emit.
 */
function resolveRuntimeCacheKey(runtimeCacheKey: string | undefined): string {
  const key = runtimeCacheKey ?? String(process.pid);
  if (!/^[A-Za-z0-9._-]+$/.test(key) || key === "." || key === "..") {
    throw new Error(`ttsx: invalid runtime cache key ${JSON.stringify(key)}`);
  }
  return key;
}

/**
 * @param discoveryFile - The entry as the user named it. Project discovery
 *   walks up from here, so it must not be retargeted through a symlink.
 */
function createProjectContext(
  cwd: string,
  discoveryFile: string,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
) {
  const project = readProjectConfig(
    options.project
      ? {
          cwd,
          projectRoot: options.projectRoot,
          tsconfig: path.resolve(cwd, options.project),
        }
      : { cwd, file: discoveryFile, projectRoot: options.projectRoot },
  );
  const tsconfig = project.path;
  const root = project.root;
  const explicitCacheDir = resolveCacheDir(cwd, options.cacheDir);
  const cacheDirSpelling =
    explicitCacheDir ??
    path.join(root, "node_modules", ".cache", "ttsc", "ttsx");
  const runtimeCacheKey = resolveRuntimeCacheKey(options.runtimeCacheKey);
  // Resolved once: it now costs a realpath (and, for a missing directory on
  // Windows, a case-sensitivity probe) rather than a string join.
  const runtimeRootDir = resolveRuntimeSourceRoot(project, options);
  fs.mkdirSync(cacheDirSpelling, { recursive: true });
  // Pin the cache parent before deriving a generation path. Descriptors run
  // after this point and may retarget a caller-controlled symlink or junction;
  // every later runtime write and recursive cleanup must remain below the
  // physical parent selected here.
  const cacheDir =
    createFilesystemPathIdentityContext().resolve(cacheDirSpelling).path;
  const processDir = path.join(cacheDir, "project", runtimeCacheKey);
  const virtualRoot = path.join(processDir, "fs");
  return {
    project,
    tsconfig,
    root,
    cacheDir,
    runtimeCacheKey,
    processDir,
    pluginCacheDir: explicitCacheDir === undefined ? undefined : cacheDir,
    virtualRoot,
    emitDir: project.compilerOptions.outDir
      ? virtualPath(virtualRoot, project.compilerOptions.outDir)
      : virtualPath(virtualRoot, runtimeRootDir),
    // The source-tree root the emit mirrors (tsgo strips this prefix). Used to
    // map a source `.ts` back to its emitted `.js` when the runtime hooks serve
    // the built entry under its source URL.
    runtimeRootDir,
    // The tsconfig options that decide the emit format, so the runtime hooks
    // classify each served file the same way tsgo chose when emitting it.
    // `target` belongs here as much as `module` does: with `module` absent tsgo
    // derives the module kind from `target`, so publishing only `module` makes
    // the hooks guess.
    moduleOptions: projectModuleOptions(project.compilerOptions),
    // Force a source map on the transient runtime emit only when the project
    // configures none — when it already emits `sourceMap` or `inlineSourceMap`,
    // the serve path inlines/absolutizes that map, so no override is needed
    // (issue #353).
    forceRuntimeSourceMap:
      project.compilerOptions.sourceMap !== true &&
      project.compilerOptions.inlineSourceMap !== true,
    built: false,
    outputs: [] as readonly string[],
  };
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

function buildProject(
  context: ReturnType<typeof createProjectContext>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
): void {
  if (context.built) return;

  fs.mkdirSync(context.cacheDir, { recursive: true });
  fs.rmSync(context.processDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(context.emitDir), { recursive: true });
  const result = runBuild({
    binary: options.binary,
    checkers: options.checkers,
    cwd: context.root,
    emit: true,
    env: options.env,
    cacheDir: context.pluginCacheDir,
    outDir: context.emitDir,
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
    linkVirtualProjectLayout(context);
    context.built = true;
    return;
  }

  removeRuntimeOutput(context.processDir);
  const detail = [
    `ttsx: project check failed for ${context.tsconfig}`,
    result.stderr || result.stdout,
  ]
    .filter((line) => line.trim().length !== 0)
    .join("\n");
  throw new Error(detail);
}

function removeRuntimeOutput(directory: string): void {
  try {
    fs.rmSync(directory, { recursive: true, force: true });
  } catch {
    // Best effort: cleanup must not hide the original preparation failure.
  }
}

function resolveCacheDir(cwd: string, cacheDir?: string): string | undefined {
  if (!cacheDir) {
    return undefined;
  }
  return path.isAbsolute(cacheDir) ? cacheDir : path.resolve(cwd, cacheDir);
}

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
 * collected directories are reversed so callers can iterate outermost-first,
 * which lets inner symlinks override outer ones without conflicting mkdir
 * calls.
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
 * get a sanitized label (e.g. `"C_"` for `C:\`), preventing collisions between
 * paths from different drives inside the same virtual root.
 */
function virtualPath(root: string, absolute: string): string {
  const parsed = path.parse(path.resolve(absolute));
  const label =
    parsed.root === path.sep
      ? "posix"
      : parsed.root.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") ||
        "root";
  const relative = path.relative(parsed.root, path.resolve(absolute));
  return path.join(root, label, relative);
}
