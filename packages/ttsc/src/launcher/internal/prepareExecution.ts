import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";
import { createFilesystemPathIdentityContext } from "../../internal/projectInputPathIdentity";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";
import {
  type OwningModuleOptions,
  isWithin,
  projectModuleOptions,
} from "./runtimeHooks";

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
  const context = createProjectContext(
    path.resolve(options.cwd ?? process.cwd()),
    entryFile,
    options,
  );
  try {
    buildProject(context, options);
    let emittedEntry = emittedEntryOf(context, entryFile);
    if (emittedEntry === null) {
      buildEntryProject(context, options, entryFile);
      emittedEntry = emittedEntryOf(context, entryFile);
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
 * The JavaScript this build emitted for `entryFile`, or `null` when it emitted
 * none — which is the signal that the entry sits outside the project's file
 * set.
 *
 * The `isWithin` guard is what makes this an ownership answer rather than a
 * guess. tsgo strips `runtimeRootDir` from every output path, so a file outside
 * that root cannot have an output under `outDir` at all; without the guard the
 * lookup falls through to `resolveEmittedJavaScript`'s trailing-stem matcher,
 * and a `build/release.ts` would happily match the `release.js` emitted for an
 * unrelated `src/release.ts` — running the wrong file instead of compiling the
 * requested one. It is also the same guard `serveEntryEmit` applies, so the
 * gate and the runtime hooks agree on which files this emit owns.
 */
function emittedEntryOf(
  context: ReturnType<typeof createProjectContext>,
  entryFile: string,
): string | null {
  if (!isWithin(path.resolve(entryFile), context.runtimeRootDir)) {
    return null;
  }
  return resolveEmittedJavaScript({
    emittedFiles: context.emittedFiles ?? undefined,
    outDir: context.emitDir,
    projectRoot: context.runtimeRootDir,
    sourceFile: entryFile,
  });
}

function createProjectContext(
  cwd: string,
  filename: string,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
) {
  const project = readProjectConfig(
    options.project
      ? {
          cwd,
          projectRoot: options.projectRoot,
          tsconfig: path.resolve(cwd, options.project),
        }
      : { cwd, file: filename, projectRoot: options.projectRoot },
  );
  const tsconfig = project.path;
  const root = project.root;
  const explicitCacheDir = resolveCacheDir(cwd, options.cacheDir);
  const cacheDir =
    explicitCacheDir ??
    path.join(root, "node_modules", ".cache", "ttsc", "ttsx");
  const processDir = path.join(cacheDir, "project", PROCESS_CACHE_KEY);
  const virtualRoot = path.join(processDir, "fs");
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
      : virtualPath(virtualRoot, resolveRuntimeSourceRoot(project, filename)),
    // The source-tree root the emit mirrors (tsgo strips this prefix). Used to
    // map a source `.ts` back to its emitted `.js` when the runtime hooks serve
    // the built entry under its source URL.
    runtimeRootDir: resolveRuntimeSourceRoot(project, filename),
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

function resolveRuntimeSourceRoot(
  project: ReturnType<typeof readProjectConfig>,
  filename: string,
): string {
  const rootDir = project.compilerOptions.rootDir;
  if (typeof rootDir === "string") {
    return path.isAbsolute(rootDir)
      ? rootDir
      : path.resolve(project.root, rootDir);
  }
  return path.dirname(filename);
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
 * the entry, which for the layout this exists for is the project root itself.
 * It has to widen at all because the inherited `rootDir` (`src`) does not
 * contain the entry, and it must not widen further: the manifest's `rootDir` is
 * what bounds the files the runtime hooks will try to serve from this emit, and
 * a volume-root bound would offer every raw `.ts` on disk to a lookup that
 * falls back to matching trailing path segments.
 */
function buildEntryProject(
  context: ReturnType<typeof createProjectContext>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
  entryFile: string,
): void {
  const entry = path.resolve(entryFile);
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
 * runtime hooks use to consume this value, and the answer is resolved through
 * it too. The project root arrives realpath-resolved while the entry does not,
 * so on any host where the two spellings differ — macOS `/var` against
 * `/private/var`, a Windows drive letter cased differently by `TEMP` than by
 * the canonical path — a textual walk finds no shared ancestor and climbs to
 * the volume root. Returning the entry's own spelling instead would satisfy the
 * identity predicate while leaving tsgo, which takes `rootDir` verbatim, unable
 * to place any sibling source under it.
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
