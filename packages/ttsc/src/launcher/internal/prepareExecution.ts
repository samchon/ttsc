import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

/** Subdirectory name that isolates concurrent ttsx processes by PID. */
const PROCESS_CACHE_KEY = String(process.pid);
/**
 * Maximum number of ancestor directories above the project root that the
 * virtual filesystem overlay mirrors. Three levels covers the common monorepo
 * layout (workspace-root → packages → package-root) so `node_modules` symlinks
 * resolve correctly without reaching an unsafe boundary.
 */
const MAX_VIRTUAL_PARENT_DEPTH = 3;

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
  moduleOption?: string;
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
    const emittedEntry = resolveEmittedJavaScript({
      emittedFiles: context.emittedFiles ?? undefined,
      outDir: context.emitDir,
      projectRoot: context.root,
      sourceFile: entryFile,
    });
    if (emittedEntry === null) {
      throw new Error(`ttsx: emitted entry not found for ${entryFile}`);
    }
    return {
      cleanupDir: context.processDir,
      emitDir: context.emitDir,
      emittedFiles: context.emittedFiles ?? undefined,
      entryFile: emittedEntry,
      moduleOption: context.moduleOption,
      projectRoot: context.root,
      rootDir: context.runtimeRootDir,
    };
  } catch (error) {
    removeRuntimeOutput(context.processDir);
    throw error;
  }
}

function createProjectContext(
  cwd: string,
  filename: string,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
) {
  const project = readProjectConfig(
    options.project
      ? { cwd, tsconfig: path.resolve(cwd, options.project) }
      : { cwd, file: filename },
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
    // The tsconfig `module` option, so the runtime hooks classify each served
    // file's format the same way tsgo chose when emitting it.
    moduleOption:
      typeof project.compilerOptions.module === "string"
        ? project.compilerOptions.module
        : undefined,
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
    plugins: options.plugins,
    quiet: true,
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
