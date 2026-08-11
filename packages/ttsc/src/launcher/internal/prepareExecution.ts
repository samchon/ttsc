import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { isOutsideRelativePath } from "../../compiler/internal/paths";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";
import { createFilesystemPathIdentityContext } from "../../internal/projectInputPathIdentity";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import { type OwningModuleOptions, projectModuleOptions } from "./runtimeHooks";

/** Subdirectory name that isolates concurrent ttsx processes by PID. */
const PROCESS_CACHE_KEY = String(process.pid);
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

/** Build the owning project and locate the emitted JavaScript entry for `ttsx`. */
export function prepareExecution(
  entryFile: string,
  options: TtscCommonOptions & {
    cacheDir?: string;
    project?: string;
  } = {},
): {
  cleanupDir: string;
  emitDir: string;
  emittedFiles?: readonly string[];
  entryFile: string;
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
      emittedFiles: context.emittedFiles ?? undefined,
      entryFile: emittedEntry,
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
 * The JavaScript this build emitted for `entry`, or `null` when it emitted none
 * — which is the signal that the entry sits outside the project's file set.
 *
 * The guard is what makes this an ownership answer rather than a guess. tsgo
 * strips `runtimeRootDir` from every output path, so a file outside that root
 * cannot have an output under `outDir` at all; without the guard the lookup
 * falls through to `resolveEmittedJavaScript`'s trailing-stem matcher, and a
 * `build/release.ts` would happily match the `release.js` emitted for an
 * unrelated `src/release.ts` — running the wrong file instead of compiling the
 * requested one.
 *
 * It is lexical on purpose, and it is the same test `resolveEmittedJavaScript`
 * then applies — including its rejection of an entry that _is_ the root. That
 * only holds because both sides are _produced_ physically: the entry by
 * `resolveEntrySpelling`, the root by `resolveRuntimeSourceRoot`. Folding here
 * instead would paper over a mixed pair and disagree with the mirror that runs
 * immediately after; keeping the pair honest is what makes folding
 * unnecessary.
 */
function emittedEntryOf(
  context: ReturnType<typeof createProjectContext>,
  entry: string,
): string | null {
  const relative = path.relative(context.runtimeRootDir, entry);
  if (relative === "" || isOutsideRelativePath(relative)) {
    return null;
  }
  return resolveEmittedJavaScript({
    emittedFiles: context.emittedFiles ?? undefined,
    outDir: context.emitDir,
    projectRoot: context.runtimeRootDir,
    sourceFile: entry,
  });
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
  const cacheDir =
    explicitCacheDir ??
    path.join(root, "node_modules", ".cache", "ttsc", "ttsx");
  const processDir = path.join(cacheDir, "project", PROCESS_CACHE_KEY);
  const virtualRoot = path.join(processDir, "fs");
  // Resolved once: it now costs a realpath (and, for a missing directory on
  // Windows, a case-sensitivity probe) rather than a string join.
  const runtimeRootDir = resolveRuntimeSourceRoot(project);
  return {
    project,
    tsconfig,
    root,
    cacheDir,
    processDir,
    pluginCacheDir: explicitCacheDir,
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
    emittedFiles: undefined as string[] | undefined,
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
 * worked. `runtimeHooks.ts::resolveDependencySourceRoot` and
 * `watchTopology.ts::inferPerSourceCompilerOutputs` already model the same
 * rule, and `runBuild.ts::pinnedRootDirArgs` pins it for tsgo itself.
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
): string {
  const rootDir = project.compilerOptions.rootDir;
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
    forceListEmittedFiles: true,
    cacheDir: context.pluginCacheDir,
    outDir: context.emitDir,
    passthrough: options.passthrough,
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
    linkVirtualProjectLayout(context);
    context.built = true;
    context.emittedFiles =
      result.emittedFiles && result.emittedFiles.length !== 0
        ? result.emittedFiles
        : undefined;
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

/**
 * Build an entry the owning project's file set does not contain.
 *
 * `ttsc` selects a _file set_: a project whose `include` is `src` must emit
 * only `src` into `outDir`, and a `clear.ts`, a `build/release.ts`, or a
 * `lint.config.ts` beside the tsconfig has no business in `lib`. `ttsx` selects
 * an _entry_: it needs that same project's compiler options, not its file list.
 * Those two requirements are not in conflict, but the whole-project build
 * cannot satisfy the second one, so an entry it did not emit is compiled here
 * through a project that inherits every option and declares only the entry.
 *
 * The synthesized tsconfig is written beside the real one on purpose. `extends`
 * with an absolute path would resolve from anywhere, but `${configDir}` and
 * `paths` are anchored to the directory of the config that consumes them, so
 * any other location silently retargets them. It is removed as soon as the
 * build returns.
 *
 * `rootDir` widens to the nearest directory holding both the project root and
 * the entry — for the layout this exists for, the project root itself; for an
 * entry that is a symlink out of the tree, the ancestor the two trees share. It
 * has to widen at least that far, because the inherited `rootDir` (`src`) does
 * not contain the entry and tsgo emits an input outside `rootDir` to its own
 * source path.
 *
 * Widening costs precision, not safety. The manifest's `rootDir` bounds which
 * files the runtime hooks will try to serve from this emit, so a wide one
 * admits more sources to the lookup — but the lookup only ever answers with a
 * file from this build's own emit directory, whether from `emittedFiles` or a
 * scan of `outDir` (`resolveEmittedJavaScript`). What a wide root risks is the
 * exact mirror missing and the trailing-stem matcher picking the wrong output
 * _of this build_; it cannot reach a raw source on disk.
 */
function buildEntryProject(
  context: ReturnType<typeof createProjectContext>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
  entry: string,
): void {
  // `entry` already carries the one spelling `prepareExecution` decided on.
  // tsgo compares it against `rootDir` textually — `GetCommonSourceDirectory`
  // takes `rootDir` verbatim and `ContainsPath` is lexical — so a mismatch here
  // is not a near miss: the entry counts as outside `rootDir`, and tsgo emits
  // it to its own source path with the extension changed instead of under
  // `outDir`, writing a `.js` and its map beside the user's `.ts` where nothing
  // cleans them up.
  const rootDir = commonAncestorDirectory(path.dirname(entry), context.root);
  const tsconfig = path.join(
    context.root,
    `.ttsx-entry.${PROCESS_CACHE_KEY}.tsconfig.json`,
  );
  fs.writeFileSync(
    tsconfig,
    JSON.stringify(
      {
        extends: context.tsconfig.replace(/\\/g, "/"),
        compilerOptions: { rootDir: rootDir.replace(/\\/g, "/") },
        // `files` alone does not displace an inherited `include`, and an
        // inherited `exclude` could drop the entry back out of the program, so
        // both are overridden explicitly.
        files: [entry.replace(/\\/g, "/")],
        include: [],
        exclude: [],
      },
      null,
      2,
    ),
    "utf8",
  );
  try {
    const project = readProjectConfig({
      cwd: context.root,
      projectRoot: options.projectRoot,
      tsconfig,
    });
    const emitDir = path.join(context.virtualRoot, ENTRY_PROJECT_EMIT_DIR);
    fs.mkdirSync(emitDir, { recursive: true });
    const result = runBuild({
      binary: options.binary,
      checkers: options.checkers,
      cwd: context.root,
      emit: true,
      env: options.env,
      forceListEmittedFiles: true,
      cacheDir: context.pluginCacheDir,
      outDir: emitDir,
      passthrough: options.passthrough,
      forceRuntimeSourceMap: context.forceRuntimeSourceMap,
      pluginConfigDir: options.pluginConfigDir,
      plugins: options.plugins,
      quiet: true,
      resolvedProject: project,
      singleThreaded: options.singleThreaded,
      tsconfig,
    });
    if (result.status !== 0) {
      removeRuntimeOutput(context.processDir);
      throw new Error(
        [
          `ttsx: entry check failed for ${entry}`,
          result.stderr || result.stdout,
        ]
          .filter((line) => line.trim().length !== 0)
          .join("\n"),
      );
    }
    context.emitDir = emitDir;
    context.runtimeRootDir = rootDir;
    context.moduleOptions = projectModuleOptions(project.compilerOptions);
    context.emittedFiles =
      result.emittedFiles && result.emittedFiles.length !== 0
        ? result.emittedFiles
        : undefined;
  } finally {
    try {
      fs.rmSync(tsconfig, { force: true });
    } catch {
      // Best effort: a leftover synthesized tsconfig must not mask a build
      // failure, and it is PID-scoped so it can never be mistaken for a real
      // project config.
    }
  }
}

/**
 * The nearest directory containing both `left` and `right`, in the physical
 * spelling both of them share.
 *
 * Containment is asked through the same filesystem-identity predicate the
 * runtime hooks use, and the answer is resolved through it too. Its caller now
 * passes an already-resolved directory, so the two spellings agree before the
 * walk starts; the predicate stays because this returns a `rootDir` that tsgo
 * takes verbatim, and answering in anything but the physical spelling would
 * leave tsgo unable to place a sibling source under it.
 *
 * Falls back to the entry's directory when there genuinely is no shared
 * ancestor, as on two different Windows volumes: the entry still has to
 * compile, and a root that contains it is the closest thing to correct
 * available.
 */
function commonAncestorDirectory(left: string, right: string): string {
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  const from = identities.resolve(path.resolve(left)).path;
  const target = identities.resolve(path.resolve(right)).path;
  let current = from;
  for (;;) {
    if (identities.isWithin(current, target)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return from;
    }
    current = parent;
  }
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

// Exported for direct exercise by the ttsx e2e suite: the Windows fallback
// branches below cannot be reached through a spawned run on CI (creating a
// file-symlink fixture needs the very privilege the fallback avoids).
export function linkVirtualEntry(
  realEntry: string,
  virtualEntry: string,
  entry: fs.Dirent,
): void {
  if (entry.isDirectory()) {
    // Use junction points on Windows; plain symlinks elsewhere.
    fs.symlinkSync(
      realEntry,
      virtualEntry,
      process.platform === "win32" ? "junction" : undefined,
    );
    return;
  }
  if (entry.isFile()) {
    try {
      // Hard-link first: cheap, preserves inode, no extra disk usage.
      fs.linkSync(realEntry, virtualEntry);
    } catch {
      // Cross-device or unsupported filesystem: fall back to a full copy.
      fs.copyFileSync(realEntry, virtualEntry);
    }
    return;
  }
  if (
    process.platform === "win32" &&
    entry.isSymbolicLink() &&
    isDirectorySymlinkTarget(realEntry)
  ) {
    fs.symlinkSync(realEntry, virtualEntry, "junction");
    return;
  }
  // Symlinks (and other special entries) are re-symlinked as-is. On Windows,
  // a file symlink needs SeCreateSymbolicLinkPrivilege (admin or Developer
  // Mode), so mirror the plain-file branch's hard-link/copy fallback instead
  // of failing the run (#306). A link whose target no longer exists is
  // skipped: it can serve no module, and none of the fallbacks can
  // materialize it without symlink privileges.
  try {
    fs.symlinkSync(realEntry, virtualEntry);
  } catch {
    if (!fs.existsSync(realEntry)) {
      return;
    }
    try {
      fs.linkSync(realEntry, virtualEntry);
    } catch {
      fs.copyFileSync(realEntry, virtualEntry);
    }
  }
}

function isDirectorySymlinkTarget(realEntry: string): boolean {
  try {
    return fs.statSync(realEntry).isDirectory();
  } catch {
    return false;
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
    if (parent === current || isUnsafeVirtualParent(parent)) {
      break;
    }
    current = parent;
  }
  return out.reverse();
}

function isUnsafeVirtualParent(directory: string): boolean {
  const resolved = path.resolve(directory);
  const root = path.parse(resolved).root;
  return resolved === root || resolved === path.resolve(os.tmpdir());
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
