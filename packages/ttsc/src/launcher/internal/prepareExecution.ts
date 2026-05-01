import * as fs from "node:fs";
import * as path from "node:path";

import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";
import { resolveProjectConfig } from "../../compiler/internal/project/resolveProjectConfig";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

const PROCESS_CACHE_KEY = String(process.pid);

/** Build the owning project and locate the emitted JavaScript entry for `ttsx`. */
export function prepareExecution(
  entryFile: string,
  options: TtscCommonOptions & {
    cacheDir?: string;
    project?: string;
  } = {},
): {
  emitDir: string;
  entryFile: string;
  moduleKind: "cjs" | "esm";
} {
  const context = createProjectContext(
    path.resolve(options.cwd ?? process.cwd()),
    entryFile,
    options,
  );
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
  const output = fs.readFileSync(emittedEntry, "utf8");
  return {
    emitDir: context.emitDir,
    entryFile: emittedEntry,
    moduleKind: looksLikeESM(output) ? "esm" : "cjs",
  };
}

function createProjectContext(
  cwd: string,
  filename: string,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
) {
  const tsconfig = options.project
    ? resolveProjectConfig({ cwd, tsconfig: path.resolve(cwd, options.project) })
    : resolveProjectConfig({ cwd, file: filename });
  const root = path.dirname(tsconfig);
  const cacheDir =
    options.cacheDir ?? path.join(root, "node_modules", ".cache", "ttsc", "ttsx");
  return {
    tsconfig,
    root,
    cacheDir,
    emitDir: path.join(cacheDir, "project", PROCESS_CACHE_KEY),
    built: false,
    emittedFiles: undefined as string[] | undefined,
  };
}

function buildProject(
  context: ReturnType<typeof createProjectContext>,
  options: NonNullable<Parameters<typeof prepareExecution>[1]>,
): void {
  if (context.built) return;

  fs.mkdirSync(context.cacheDir, { recursive: true });
  fs.rmSync(context.emitDir, { recursive: true, force: true });
  const result = runBuild({
    binary: options.binary,
    cwd: context.root,
    emit: true,
    env: options.env,
    forceListEmittedFiles: true,
    outDir: context.emitDir,
    plugins: options.plugins,
    quiet: true,
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

  fs.rmSync(context.emitDir, { recursive: true, force: true });
  const detail = [
    `ttsx: project check failed for ${context.tsconfig}`,
    result.stderr || result.stdout,
  ]
    .filter((line) => line.trim().length !== 0)
    .join("\n");
  throw new Error(detail);
}

function looksLikeESM(output: string): boolean {
  if (
    /\bObject\.defineProperty\(exports\b/.test(output) ||
    /\bmodule\.exports\b/.test(output) ||
    /\brequire\(/.test(output) ||
    /\bexports\./.test(output)
  ) {
    return false;
  }
  return /^\s*(import|export)\s/m.test(output);
}
