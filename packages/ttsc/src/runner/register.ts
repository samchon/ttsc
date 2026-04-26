import * as fs from "node:fs";
import * as path from "node:path";

import {
  build,
  check,
  type CommonOptions,
} from "../api";
import {
  defaultCacheDirectory,
  resolveProjectConfig,
  resolveProjectRoot,
} from "../project";

export interface RegisterOptions extends CommonOptions {
  cacheDir?: string;
  project?: string;
  extensions?: readonly string[];
}

export interface PreparedExecution {
  emitDir: string;
  entryFile: string;
  moduleKind: "cjs" | "esm";
}

type RequireExtension = (module: NodeJS.Module, filename: string) => void;
type CompilableModule = NodeJS.Module & {
  _compile(code: string, filename: string): void;
};

interface ProjectContext {
  cacheDir: string;
  emitDir: string;
  emittedFiles: string[] | null;
  diagnosticsChecked: boolean;
  entryMap: Map<string, string>;
  root: string;
  tsconfig: string;
}

const DEFAULT_EXTENSIONS: readonly string[] = Object.freeze([
  ".ts",
  ".tsx",
  ".cts",
  ".mts",
]);

const PROCESS_CACHE_KEY = String(process.pid);
const preparedContexts = new Map<string, ProjectContext>();

export function register(options: RegisterOptions = {}): () => void {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const extensions = [...(options.extensions ?? DEFAULT_EXTENSIONS)];
  const contextCache = new Map<string, ProjectContext>();
  const previous = new Map<string, RequireExtension | undefined>();

  const getContext = (filename: string): ProjectContext => {
    if (options.project) {
      const key = path.resolve(cwd, options.project);
      const cached = contextCache.get(key);
      if (cached) return cached;
      const tsconfig = resolveProjectConfig({ cwd, tsconfig: key });
      const root = resolveProjectRoot({ cwd, tsconfig });
      const cacheDir = options.cacheDir ?? defaultCacheDirectory(root, "ttsx");
      const prepared = takePreparedContext(tsconfig, cacheDir, options);
      if (prepared) {
        contextCache.set(key, prepared);
        return prepared;
      }
      const created = {
        tsconfig,
        root,
        cacheDir,
        diagnosticsChecked: false,
        emitDir: path.join(cacheDir, "project", PROCESS_CACHE_KEY),
        emittedFiles: null,
        entryMap: new Map<string, string>(),
      };
      contextCache.set(key, created);
      return created;
    }

    const tsconfig = resolveProjectConfig({ cwd, file: filename });
    const cached = contextCache.get(tsconfig);
    if (cached) return cached;
    const root = resolveProjectRoot({ cwd, tsconfig });
    const cacheDir = options.cacheDir ?? defaultCacheDirectory(root, "ttsx");
    const prepared = takePreparedContext(tsconfig, cacheDir, options);
    if (prepared) {
      contextCache.set(tsconfig, prepared);
      return prepared;
    }
    const created = {
      tsconfig,
      root,
      cacheDir,
      diagnosticsChecked: false,
      emitDir: path.join(cacheDir, "project", PROCESS_CACHE_KEY),
      emittedFiles: null,
      entryMap: new Map<string, string>(),
    };
    contextCache.set(tsconfig, created);
    return created;
  };

  const compile = (filename: string): string => {
    const context = getContext(filename);
    ensureProjectDiagnostics(context, options);
    const output = readCompiledOutput(context, filename, options);
    if (looksLikeESM(output)) {
      throw new Error(
        `ttsx: ESM output is not yet supported by the in-process CJS runner (${filename}).`,
      );
    }
    return output;
  };

  for (const extension of extensions) {
    previous.set(extension, require.extensions[extension]);
    require.extensions[extension] = (module: NodeJS.Module, filename: string) => {
      const compiled = compile(filename);
      (module as CompilableModule)._compile(compiled, filename);
    };
  }

  return () => {
    for (const extension of extensions) {
      const handler = previous.get(extension);
      if (handler) {
        require.extensions[extension] = handler;
      } else {
        delete require.extensions[extension];
      }
    }
  };
}

export function prepareExecution(
  entryFile: string,
  options: RegisterOptions = {},
): PreparedExecution {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const context = resolveProjectContext(cwd, entryFile, options);
  ensureProjectDiagnostics(context, options);
  const entryOutput = readCompiledOutput(context, entryFile, options);
  if (!looksLikeESM(entryOutput)) {
    storePreparedContext(context, options);
    return {
      emitDir: context.emitDir,
      entryFile,
      moduleKind: "cjs",
    };
  }
  ensureProjectBuild(context, options);
  const resolvedEntry = resolveEmittedFile(context, entryFile);
  if (resolvedEntry === null) {
    throw new Error(`ttsx: emitted entry not found for ${entryFile}`);
  }
  const output = fs.readFileSync(resolvedEntry, "utf8");
  return {
    emitDir: context.emitDir,
    entryFile: resolvedEntry,
    moduleKind: looksLikeESM(output) ? "esm" : "cjs",
  };
}

function storePreparedContext(
  context: ProjectContext,
  options: RegisterOptions,
): void {
  preparedContexts.set(preparedContextKey(context.tsconfig, context.cacheDir, options), context);
}

function takePreparedContext(
  tsconfig: string,
  cacheDir: string,
  options: RegisterOptions,
): ProjectContext | null {
  const key = preparedContextKey(tsconfig, cacheDir, options);
  const context = preparedContexts.get(key);
  if (!context) {
    return null;
  }
  preparedContexts.delete(key);
  return context;
}

function preparedContextKey(
  tsconfig: string,
  cacheDir: string,
  options: RegisterOptions,
): string {
  return JSON.stringify([
    PROCESS_CACHE_KEY,
    tsconfig,
    cacheDir,
    options.binary ?? "",
    options.rewriteMode ?? "",
    options.env?.TTSC_TSGO_BINARY ?? "",
    options.env?.TTSC_BINARY ?? "",
    options.plugins === false ? false : options.plugins ?? null,
  ]);
}

function ensureProjectBuild(context: ProjectContext, options: RegisterOptions): void {
  if (context.emittedFiles !== null) return;

  fs.mkdirSync(context.cacheDir, { recursive: true });
  fs.rmSync(context.emitDir, { recursive: true, force: true });
  const result = build({
    binary: options.binary,
    cwd: context.root,
    env: options.env,
    emit: true,
    outDir: context.emitDir,
    plugins: options.plugins,
    quiet: true,
    rewriteMode: options.rewriteMode,
    skipDiagnosticsCheck: context.diagnosticsChecked,
    tsconfig: context.tsconfig,
  });
  if (result.status === 0) {
    context.emittedFiles = listEmittedFiles(context.emitDir);
    return;
  }

  fs.rmSync(context.emitDir, { recursive: true, force: true });
  const detail = [
    `ttsx: project build failed for ${context.tsconfig}`,
    result.stderr || result.stdout,
  ]
    .filter((line) => line.trim().length !== 0)
    .join("\n");
  throw new Error(detail);
}

function readCompiledOutput(
  context: ProjectContext,
  filename: string,
  options: RegisterOptions,
): string {
  ensureProjectBuild(context, options);
  const emitted = resolveEmittedFile(context, filename);
  if (!emitted) {
    throw new Error(`ttsx: emitted file not found for ${filename}`);
  }
  return fs.readFileSync(emitted, "utf8");
}

function resolveProjectContext(
  cwd: string,
  filename: string,
  options: RegisterOptions,
): ProjectContext {
  if (options.project) {
    const tsconfig = resolveProjectConfig({
      cwd,
      tsconfig: path.resolve(cwd, options.project),
    });
    return createProjectContext(cwd, tsconfig, options);
  }
  const tsconfig = resolveProjectConfig({ cwd, file: filename });
  return createProjectContext(cwd, tsconfig, options);
}

function createProjectContext(
  cwd: string,
  tsconfig: string,
  options: RegisterOptions,
): ProjectContext {
  const root = resolveProjectRoot({ cwd, tsconfig });
  const cacheDir = options.cacheDir ?? defaultCacheDirectory(root, "ttsx");
  return {
    tsconfig,
    root,
    cacheDir,
    diagnosticsChecked: false,
    emitDir: path.join(cacheDir, "project", PROCESS_CACHE_KEY),
    emittedFiles: null,
    entryMap: new Map<string, string>(),
  };
}

function ensureProjectDiagnostics(
  context: ProjectContext,
  options: RegisterOptions,
): void {
  if (context.diagnosticsChecked) {
    return;
  }
  const result = check({
    binary: options.binary,
    cwd: context.root,
    env: options.env,
    plugins: options.plugins,
    quiet: true,
    rewriteMode: options.rewriteMode,
    tsconfig: context.tsconfig,
  });
  if (result.status !== 0) {
    const detail = [result.stderr.trim(), result.stdout.trim()]
      .filter(Boolean)
      .join("\n");
    throw new Error(
      `ttsx: project check failed for ${context.tsconfig}` +
        (detail ? `\n${detail}` : ""),
    );
  }
  context.diagnosticsChecked = true;
}

function resolveEmittedFile(context: ProjectContext, filename: string): string | null {
  const normalized = path.resolve(filename);
  const cached = context.entryMap.get(normalized);
  if (cached && fs.existsSync(cached)) return cached;

  const exact = resolveExactEmittedFile(context, normalized);
  if (exact && fs.existsSync(exact)) {
    context.entryMap.set(normalized, exact);
    return exact;
  }

  const files = context.emittedFiles ?? [];
  let best: string | null = null;
  let bestScore = 0;
  for (const file of files) {
    const score = sharedSourceStemSegments(file, normalized);
    if (score > bestScore) {
      best = file;
      bestScore = score;
    }
  }
  if (!best || !fs.existsSync(best)) {
    return null;
  }
  context.entryMap.set(normalized, best);
  return best;
}

function resolveExactEmittedFile(
  context: ProjectContext,
  filename: string,
): string | null {
  const relative = path.relative(context.root, filename);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return path.resolve(
    context.emitDir,
    relative.slice(0, relative.length - path.extname(relative).length) +
      emittedJavaScriptExtension(filename),
  );
}

function listEmittedFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const output: string[] = [];
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && isJavaScriptOutput(next)) {
        output.push(path.resolve(next));
      }
    }
  }
  return output;
}

function sharedSourceStemSegments(outPath: string, srcPath: string): number {
  const trim = (location: string): string[] => {
    const normalized = location.split(path.sep).join("/");
    return normalized
      .slice(0, normalized.length - path.extname(normalized).length)
      .split("/");
  };
  const a = trim(outPath);
  const b = trim(srcPath);
  const count = Math.min(a.length, b.length);
  let shared = 0;
  for (let i = 1; i <= count; i += 1) {
    if (a[a.length - i] !== b[b.length - i]) break;
    shared += 1;
  }
  return shared;
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

function emittedJavaScriptExtension(filename: string): string {
  switch (path.extname(filename).toLowerCase()) {
    case ".mts":
      return ".mjs";
    case ".cts":
      return ".cjs";
    default:
      return ".js";
  }
}

function isJavaScriptOutput(filename: string): boolean {
  return /\.(?:[cm]?js)$/i.test(filename);
}
