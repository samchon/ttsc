import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

/** Subdirectory name that isolates concurrent ttsx processes by PID. */
const PROCESS_CACHE_KEY = String(process.pid);

/**
 * Type-check the entry's owning project and compile its source graph into a
 * private per-run cache, returning where that cache lives plus the entry's
 * source identity.
 *
 * `ttsx` runs the entry at its own source path, not the compiled output: the
 * module hooks serve each `.ts`'s compiled bytes under the source URL so
 * `__dirname` / `import.meta.url` resolve against the real source tree. This
 * function only produces the type-check gate and the compiled-bytes store the
 * hooks read; it never touches the project's configured `outDir`.
 */
export function prepareExecution(
  entryFile: string,
  options: TtscCommonOptions & {
    cacheDir?: string;
    project?: string;
  } = {},
): {
  cleanupDir: string;
  emitDir: string;
  entryFile: string;
  entryRoot: string;
  sourceRoot: string;
  tsconfig: string;
} {
  const context = createProjectContext(
    path.resolve(options.cwd ?? process.cwd()),
    entryFile,
    options,
  );
  try {
    buildProject(context, options);
    // Confirm the gate emitted the entry's compiled bytes; the runtime hooks
    // serve them under the entry's source path. The format of each file is
    // detected per file at serve time, so nothing about it is needed here.
    const emittedEntry = resolveEmittedJavaScript({
      emittedFiles: context.emittedFiles ?? undefined,
      outDir: context.emitDir,
      projectRoot: context.sourceRoot,
      sourceFile: entryFile,
    });
    if (emittedEntry === null) {
      throw new Error(`ttsx: emitted entry not found for ${entryFile}`);
    }
    return {
      cleanupDir: context.processDir,
      emitDir: context.emitDir,
      entryFile,
      entryRoot: context.root,
      sourceRoot: context.sourceRoot,
      tsconfig: context.tsconfig,
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
  const hasRootDir = typeof project.compilerOptions.rootDir === "string";
  // ttsx always injects its own `--outDir` (the per-run byte store), and tsgo
  // rejects `outDir` without an explicit `rootDir` (TS5011). So whenever the
  // project omits `rootDir`, mirror the whole project root: every reachable
  // source then emits under a predictable, mappable layout.
  const forcedRootDir = hasRootDir ? undefined : root;
  return {
    tsconfig,
    root,
    cacheDir,
    processDir,
    pluginCacheDir: explicitCacheDir,
    rootDirArg: forcedRootDir,
    // The compiled-bytes store the runtime hooks serve from.
    emitDir: path.join(processDir, "emit"),
    // Source root the emit mirrors; maps a source `.ts` to its compiled `.js`.
    sourceRoot: forcedRootDir ?? resolveRuntimeSourceRoot(project, filename),
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
  fs.mkdirSync(context.emitDir, { recursive: true });
  const result = runBuild({
    binary: options.binary,
    checkers: options.checkers,
    cwd: context.root,
    emit: true,
    env: options.env,
    forceListEmittedFiles: true,
    cacheDir: context.pluginCacheDir,
    outDir: context.emitDir,
    passthrough: context.rootDirArg
      ? [...(options.passthrough ?? []), "--rootDir", context.rootDirArg]
      : options.passthrough,
    plugins: options.plugins,
    projectRoot: context.root,
    quiet: true,
    singleThreaded: options.singleThreaded,
    tsconfig: context.tsconfig,
  });
  if (result.status === 0) {
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
