import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";
import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import type { TtscCommonOptions } from "../../structures/internal/TtscCommonOptions";

const PROCESS_CACHE_KEY = String(process.pid);
const MAX_VIRTUAL_PARENT_DEPTH = 3;

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
  const project = readProjectConfig(
    options.project
      ? { cwd, tsconfig: path.resolve(cwd, options.project) }
      : { cwd, file: filename },
  );
  const tsconfig = project.path;
  const root = project.root;
  const cacheDir =
    options.cacheDir ?? path.join(root, "node_modules", ".cache", "ttsc", "ttsx");
  const processDir = path.join(cacheDir, "project", PROCESS_CACHE_KEY);
  const virtualRoot = path.join(processDir, "fs");
  return {
    tsconfig,
    root,
    cacheDir,
    processDir,
    virtualRoot,
    emitDir: project.compilerOptions.outDir
      ? virtualPath(virtualRoot, project.compilerOptions.outDir)
      : virtualPath(virtualRoot, resolveRuntimeSourceRoot(project, filename)),
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
    return path.isAbsolute(rootDir) ? rootDir : path.resolve(project.root, rootDir);
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
    linkVirtualProjectLayout(context);
    context.built = true;
    context.emittedFiles =
      result.emittedFiles && result.emittedFiles.length !== 0
        ? result.emittedFiles
        : undefined;
    return;
  }

  fs.rmSync(context.processDir, { recursive: true, force: true });
  const detail = [
    `ttsx: project check failed for ${context.tsconfig}`,
    result.stderr || result.stdout,
  ]
    .filter((line) => line.trim().length !== 0)
    .join("\n");
  throw new Error(detail);
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

function linkVirtualEntry(
  realEntry: string,
  virtualEntry: string,
  entry: fs.Dirent,
): void {
  if (entry.isDirectory()) {
    fs.symlinkSync(
      realEntry,
      virtualEntry,
      process.platform === "win32" ? "junction" : undefined,
    );
    return;
  }
  if (entry.isFile()) {
    try {
      fs.linkSync(realEntry, virtualEntry);
    } catch {
      fs.copyFileSync(realEntry, virtualEntry);
    }
    return;
  }
  fs.symlinkSync(realEntry, virtualEntry);
}

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
  return (
    resolved === root ||
    resolved === path.resolve(os.tmpdir())
  );
}

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
