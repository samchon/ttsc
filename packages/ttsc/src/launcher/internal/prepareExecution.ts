import fs from "node:fs";
import path from "node:path";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { runBuild } from "../../compiler/internal/runBuild";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

/** Subdirectory name that isolates concurrent ttsx processes by PID. */
const PROCESS_CACHE_KEY = String(process.pid);

/**
 * Type-check and compile the entry's owning project with tsgo.
 *
 * The project is built once into a private per-process emit directory. The
 * entry is then executed from its OWN source path (not the emit), with the
 * runtime `load` hook serving each source's compiled JavaScript as its bytes —
 * so `import.meta.url`/`__dirname`/relative reads point at the real source. The
 * returned `emitBase`/`emitDir` tell that hook how to map a source `.ts` to its
 * compiled `.js`.
 */
export function prepareExecution(
  entryFile: string,
  options: TtscCommonOptions & {
    cacheDir?: string;
    project?: string;
  } = {},
): {
  cleanupDir: string;
  emitBase: string;
  emitDir: string;
  entryFile: string;
} {
  const context = createProjectContext(
    path.resolve(options.cwd ?? process.cwd()),
    entryFile,
    options,
  );
  try {
    buildProject(context, options);
    return {
      cleanupDir: context.processDir,
      emitBase: context.emitBase,
      emitDir: context.emitDir,
      entryFile: context.entryFile,
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
  const explicitCacheDir = resolveCacheDir(cwd, options.cacheDir);
  const cacheDir =
    explicitCacheDir ??
    path.join(project.root, "node_modules", ".cache", "ttsc", "ttsx");
  const processDir = path.join(cacheDir, "project", PROCESS_CACHE_KEY);
  return {
    tsconfig: project.path,
    root: project.root,
    cacheDir,
    processDir,
    pluginCacheDir: explicitCacheDir,
    emitDir: path.join(processDir, "emit"),
    emitBase: resolveRuntimeSourceRoot(project, filename),
    entryFile: path.resolve(filename),
    built: false,
  };
}

/**
 * The directory tsgo lays the project's emit out relative to: the explicit
 * `rootDir`, or the entry file's own directory when none is configured.
 */
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
  return path.dirname(path.resolve(filename));
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
    cacheDir: context.pluginCacheDir,
    outDir: context.emitDir,
    passthrough: options.passthrough,
    plugins: options.plugins,
    quiet: true,
    singleThreaded: options.singleThreaded,
    tsconfig: context.tsconfig,
  });
  if (result.status === 0) {
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
