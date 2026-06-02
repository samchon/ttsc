import { createHash } from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import type { LoadHookSync, ResolveHookSync } from "node:module";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { readProjectConfig } from "../../compiler/internal/project/readProjectConfig";
import { resolveEmittedJavaScript } from "../../compiler/internal/resolveEmittedJavaScript";
import { runBuild } from "../../compiler/internal/runBuild";

type FsPath = string | Buffer | URL;

const nativeFs = {
  access: fs.access.bind(fs),
  accessSync: fs.accessSync.bind(fs),
  existsSync: fs.existsSync.bind(fs),
  lstat: fs.lstat.bind(fs),
  lstatSync: fs.lstatSync.bind(fs),
  promises: {
    access: fs.promises.access.bind(fs.promises),
    lstat: fs.promises.lstat.bind(fs.promises),
    readFile: fs.promises.readFile.bind(fs.promises),
    readdir: fs.promises.readdir.bind(fs.promises),
    stat: fs.promises.stat.bind(fs.promises),
  },
  readFile: fs.readFile.bind(fs),
  readFileSync: fs.readFileSync.bind(fs),
  readdir: fs.readdir.bind(fs),
  readdirSync: fs.readdirSync.bind(fs),
  realpathSync: fs.realpathSync.bind(fs),
  stat: fs.stat.bind(fs),
  statSync: fs.statSync.bind(fs),
};

/**
 * Node.js module-customization hooks `ttsx` installs (via `registerHooks`) in
 * the child process it spawns. `registerHooks` is synchronous and in-thread, so
 * the hooks cover BOTH `import` and `require` across the whole graph.
 *
 * The runtime never re-transpiles TypeScript and never relocates a module's
 * identity: every `.ts` keeps its own source path as its module URL, and the
 * `load` hook serves the JavaScript tsgo emitted for it as that module's source
 * — the same model `ts-node`/`tsx` use, but the bytes come from a real,
 * type-checked, plugin-applied tsgo build instead of a per-file transpile.
 *
 * Because identity stays at the source, `import.meta.url`, `__dirname`, and
 * relative `fs`/asset reads all point at the real source tree, exactly as if
 * the code had been authored in JavaScript there.
 *
 * - `resolve` keeps a resolved `.ts` URL as-is and maps a sibling specifier the
 *   compiler emitted (`./x.js`, or an extensionless `./x`) back to the source
 *   `.ts`, so resolution lands on real source files.
 * - `load` replaces a `.ts` source's bytes with its compiled JavaScript: the
 *   entry project's own sources come from the up-front compile gate's emit; a
 *   dependency consumed as raw `.ts` is compiled by tsgo through its own
 *   `tsconfig` into a per-package cache. The returned `format` is always plain
 *   `module`/`commonjs`, so Node never runs its native type-stripping (which
 *   bans `.ts` under `node_modules`).
 */

/** Source/JS extensions probed when an extensionless relative import fails. */
const RESOLVABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
] as const;

/** TypeScript source extensions whose modules are served from tsgo's emit. */
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

/** Config file extensions that first-party ttsc plugins auto-discover. */
const CONFIG_EXTENSIONS = [
  ".ts",
  ".cts",
  ".mts",
  ".js",
  ".cjs",
  ".mjs",
  ".json",
] as const;

/** Cached plugin source inputs, keyed by plugin package root. */
const pluginNativeInputCache = new Map<string, readonly string[]>();

/**
 * Keep a resolved TypeScript source at its own URL, and rescue a relative
 * specifier the compiler emitted (or an extensionless one) by mapping it back
 * onto the source tree.
 *
 * A successful resolution that lands on a `.ts` is returned with its TypeScript
 * `format` dropped so the `load` hook decides the real module format. A failed
 * resolution is retried against the source tree — `./x.js` → `./x.ts`, an
 * extensionless `./x` → `./x.ts`/directory index — preserving
 * `ERR_MODULE_NOT_FOUND` when nothing matches.
 */
export const resolve: ResolveHookSync = (specifier, context, nextResolve) => {
  const sourceMatch = sourceSpecifierFromTypeScriptParent(
    specifier,
    context.parentURL,
  );
  if (sourceMatch !== null) {
    return { shortCircuit: true, url: sourceMatch };
  }

  let result;
  try {
    result = nextResolve(specifier, context);
  } catch (error) {
    const rescued = rescueSourceSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    result = { shortCircuit: true, url: rescued };
  }
  if (!isTypeScriptUrl(result.url)) {
    return result;
  }
  // Drop any TypeScript `format` the resolver attached (e.g.
  // `module-typescript`): keeping it would make Node run its native
  // type-stripping on a file the `load` hook is about to replace with compiled
  // JavaScript. With it gone, `load` declares the real `module`/`commonjs`.
  const kept = { ...result, shortCircuit: true };
  delete (kept as { format?: unknown }).format;
  return kept;
};

/**
 * Bridge `ttsx`'s source-identity model into the CommonJS loader, which classic
 * `require()` uses directly and the `registerHooks` `resolve`/`load` hooks do
 * NOT reach.
 *
 * - `Module._resolveFilename` is wrapped so a relative `require` the compiler
 *   emitted (`./x`, `./x.js`) that the default resolver misses is mapped onto
 *   the source `.ts`, the same way the ESM `resolve` hook does.
 * - `Module._extensions` for each TypeScript extension compiles the source to its
 *   emitted JavaScript and runs THAT under the original `.ts` filename, so
 *   `__dirname`/`__filename` stay at the source — mirroring the `load` hook.
 */
export function installCommonJsHooks(): void {
  const internal = Module as unknown as NodeCommonJsModule;
  const resolveFilename = internal._resolveFilename;
  internal._resolveFilename = function (request, parent, isMain, options) {
    const mapped = sourceTypeScriptForRequest(request, parent);
    if (mapped !== null) {
      return mapped;
    }
    try {
      return resolveFilename.call(this, request, parent, isMain, options);
    } catch (error) {
      throw error;
    }
  };
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    internal._extensions[extension] = (module, filename) => {
      const runtime = runtimeJavaScriptForSource(filename);
      module._compile(runtime.source, filename);
    };
  }
}

let fileSystemHooksInstalled = false;

/**
 * Make emitted `.js` counterparts visible to source-directory scanners.
 *
 * Source identity keeps `__dirname` at the real source tree, but some runtime
 * loaders discover modules by scanning for compiled `.js` files before
 * importing them. The compile gate already emitted those files into ttsx's
 * private runtime directory, so expose only proven counterparts through
 * `readdir`/`stat` without writing beside the user's sources.
 */
export function installFileSystemHooks(): void {
  if (fileSystemHooksInstalled) {
    return;
  }
  fileSystemHooksInstalled = true;

  fs.existsSync = ((candidate: FsPath): boolean =>
    nativeFs.existsSync(candidate) ||
    emittedJavaScriptForVirtualPath(candidate) !==
      null) as typeof fs.existsSync;

  fs.accessSync = ((candidate: FsPath, mode?: number): void => {
    try {
      nativeFs.accessSync(candidate, mode);
    } catch (error) {
      const emitted = emittedJavaScriptForVirtualPath(candidate);
      if (emitted === null) {
        throw error;
      }
      nativeFs.accessSync(emitted, mode);
    }
  }) as typeof fs.accessSync;

  fs.access = ((candidate: FsPath, mode: unknown, callback?: unknown) => {
    const cb = typeof mode === "function" ? mode : callback;
    if (typeof cb !== "function") {
      return nativeFs.access(candidate, mode as never);
    }
    const actualMode = typeof mode === "function" ? undefined : mode;
    return nativeFs.access(
      candidate,
      actualMode as never,
      (error: NodeJS.ErrnoException | null) => {
        if (error === null) {
          cb(null);
          return;
        }
        const emitted = emittedJavaScriptForVirtualPath(candidate);
        if (emitted === null) {
          cb(error);
          return;
        }
        nativeFs.access(emitted, actualMode as never, cb as never);
      },
    );
  }) as typeof fs.access;

  fs.promises.access = (async (
    candidate: FsPath,
    mode?: number,
  ): Promise<void> => {
    try {
      await nativeFs.promises.access(candidate, mode);
    } catch (error) {
      const emitted = emittedJavaScriptForVirtualPath(candidate);
      if (emitted === null) {
        throw error;
      }
      await nativeFs.promises.access(emitted, mode);
    }
  }) as typeof fs.promises.access;

  fs.readdirSync = ((directory: FsPath, options?: unknown): unknown => {
    const entries = nativeFs.readdirSync(directory, options as never);
    return mergeVirtualJavaScriptEntries(directory, entries);
  }) as typeof fs.readdirSync;

  fs.readdir = ((directory: FsPath, options: unknown, callback?: unknown) => {
    const cb = typeof options === "function" ? options : callback;
    if (typeof cb !== "function") {
      return nativeFs.readdir(directory, options as never);
    }
    const actualOptions = typeof options === "function" ? undefined : options;
    return nativeFs.readdir(
      directory,
      actualOptions as never,
      (error: NodeJS.ErrnoException | null, entries: unknown) => {
        if (error !== null) {
          cb(error, entries);
          return;
        }
        try {
          cb(null, mergeVirtualJavaScriptEntries(directory, entries));
        } catch (mergeError) {
          cb(mergeError, entries);
        }
      },
    );
  }) as typeof fs.readdir;

  fs.promises.readdir = (async (
    directory: FsPath,
    options?: unknown,
  ): Promise<unknown> => {
    const entries = await nativeFs.promises.readdir(
      directory,
      options as never,
    );
    return mergeVirtualJavaScriptEntries(directory, entries);
  }) as typeof fs.promises.readdir;

  fs.statSync = ((candidate: FsPath, options?: unknown): fs.Stats => {
    try {
      return nativeFs.statSync(candidate, options as never);
    } catch (error) {
      const source = sourceForVirtualJavaScriptFile(candidate, error);
      if (source === null) {
        throw error;
      }
      return nativeFs.statSync(source, options as never);
    }
  }) as typeof fs.statSync;

  fs.lstatSync = ((candidate: FsPath, options?: unknown): fs.Stats => {
    try {
      return nativeFs.lstatSync(candidate, options as never);
    } catch (error) {
      const source = sourceForVirtualJavaScriptFile(candidate, error);
      if (source === null) {
        throw error;
      }
      return nativeFs.lstatSync(source, options as never);
    }
  }) as typeof fs.lstatSync;

  fs.stat = ((candidate: FsPath, options: unknown, callback?: unknown) =>
    statWithVirtualJavaScript(
      nativeFs.stat,
      candidate,
      options,
      callback,
    )) as typeof fs.stat;

  fs.lstat = ((candidate: FsPath, options: unknown, callback?: unknown) =>
    statWithVirtualJavaScript(
      nativeFs.lstat,
      candidate,
      options,
      callback,
    )) as typeof fs.lstat;

  fs.promises.stat = ((candidate: FsPath, options?: unknown) =>
    promiseStatWithVirtualJavaScript(
      nativeFs.promises.stat,
      candidate,
      options,
    )) as typeof fs.promises.stat;

  fs.promises.lstat = ((candidate: FsPath, options?: unknown) =>
    promiseStatWithVirtualJavaScript(
      nativeFs.promises.lstat,
      candidate,
      options,
    )) as typeof fs.promises.lstat;

  fs.readFileSync = ((candidate: FsPath, options?: unknown): unknown => {
    try {
      return nativeFs.readFileSync(candidate, options as never);
    } catch (error) {
      const emitted = emittedJavaScriptForVirtualPath(candidate);
      if (emitted === null) {
        throw error;
      }
      return nativeFs.readFileSync(emitted, options as never);
    }
  }) as typeof fs.readFileSync;

  fs.readFile = ((candidate: FsPath, options: unknown, callback?: unknown) => {
    const cb = typeof options === "function" ? options : callback;
    if (typeof cb !== "function") {
      return nativeFs.readFile(candidate, options as never);
    }
    const actualOptions = typeof options === "function" ? undefined : options;
    return nativeFs.readFile(
      candidate,
      actualOptions as never,
      (error: NodeJS.ErrnoException | null, content: unknown) => {
        if (error === null) {
          cb(null, content);
          return;
        }
        const emitted = emittedJavaScriptForVirtualPath(candidate);
        if (emitted === null) {
          cb(error, content);
          return;
        }
        nativeFs.readFile(emitted, actualOptions as never, cb as never);
      },
    );
  }) as typeof fs.readFile;

  fs.promises.readFile = (async (
    candidate: FsPath,
    options?: unknown,
  ): Promise<unknown> => {
    try {
      return await nativeFs.promises.readFile(candidate, options as never);
    } catch (error) {
      const emitted = emittedJavaScriptForVirtualPath(candidate);
      if (emitted === null) {
        throw error;
      }
      return nativeFs.promises.readFile(emitted, options as never);
    }
  }) as typeof fs.promises.readFile;
}

function mergeVirtualJavaScriptEntries(
  directory: FsPath,
  entries: unknown,
): unknown {
  if (!Array.isArray(entries)) {
    return entries;
  }
  if (entries.every((entry) => typeof entry === "string")) {
    const virtual = virtualJavaScriptEntries(directory, entries);
    return virtual.length === 0 ? entries : [...entries, ...virtual];
  }
  if (entries.every(isDirentLike)) {
    const names = entries.map((entry) => entry.name);
    const virtual = virtualJavaScriptEntries(directory, names);
    return virtual.length === 0
      ? entries
      : [...entries, ...virtual.map(virtualJavaScriptDirent)];
  }
  return entries;
}

function virtualJavaScriptEntries(
  directory: FsPath,
  entries: readonly string[],
): string[] {
  const sourceDir = fileSystemPath(directory);
  const entry = entryProject();
  if (sourceDir === null || entry === null) {
    return [];
  }
  const realSourceDir = realpathIfExists(sourceDir);
  if (!isInsideDirectory(entry.emitBase, realSourceDir)) {
    return [];
  }
  const emittedDir = path.join(
    entry.emitDir,
    path.relative(entry.emitBase, realSourceDir),
  );
  if (!isActualDirectory(emittedDir)) {
    return [];
  }
  const present = new Set(entries);
  const virtual: string[] = [];
  for (const emitted of nativeFs.readdirSync(emittedDir)) {
    if (!isJavaScriptOutputFile(emitted) || present.has(emitted)) {
      continue;
    }
    const source = typeScriptCounterparts(
      path.join(realSourceDir, emitted),
    ).find(isActualFile);
    if (source !== undefined) {
      present.add(emitted);
      virtual.push(emitted);
    }
  }
  return virtual;
}

function sourceForVirtualJavaScriptFile(
  candidate: FsPath,
  error: unknown,
): string | null {
  if (!isNotFoundError(error)) {
    return null;
  }
  return sourceForVirtualJavaScriptPath(candidate);
}

function sourceForVirtualJavaScriptPath(candidate: FsPath): string | null {
  const file = fileSystemPath(candidate);
  if (file === null || isActualFile(file)) {
    return null;
  }
  const source = absoluteJavaScriptSourceCounterpart(file);
  if (source === null || entryEmittedJavaScriptForSource(source) === null) {
    return null;
  }
  return source;
}

function emittedJavaScriptForVirtualPath(candidate: FsPath): string | null {
  const file = fileSystemPath(candidate);
  if (file === null || isActualFile(file)) {
    return null;
  }
  const source = absoluteJavaScriptSourceCounterpart(file);
  return source === null ? null : entryEmittedJavaScriptForSource(source);
}

function isDirentLike(entry: unknown): entry is fs.Dirent {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "name" in entry &&
    typeof (entry as { name?: unknown }).name === "string" &&
    "isFile" in entry &&
    typeof (entry as { isFile?: unknown }).isFile === "function"
  );
}

function virtualJavaScriptDirent(name: string): fs.Dirent {
  return {
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isDirectory: () => false,
    isFIFO: () => false,
    isFile: () => true,
    isSocket: () => false,
    isSymbolicLink: () => false,
    name,
  } as fs.Dirent;
}

function statWithVirtualJavaScript(
  stat: typeof fs.stat,
  candidate: FsPath,
  options: unknown,
  callback?: unknown,
): void {
  const cb = typeof options === "function" ? options : callback;
  if (typeof cb !== "function") {
    stat(candidate, options as never);
    return;
  }
  const actualOptions = typeof options === "function" ? undefined : options;
  stat(
    candidate,
    actualOptions as never,
    (error: NodeJS.ErrnoException | null, stats: fs.Stats) => {
      const source = sourceForVirtualJavaScriptFile(candidate, error);
      if (source === null) {
        cb(error, stats);
        return;
      }
      stat(source, actualOptions as never, cb as never);
    },
  );
}

async function promiseStatWithVirtualJavaScript(
  stat: typeof fs.promises.stat,
  candidate: FsPath,
  options: unknown,
): Promise<fs.Stats> {
  try {
    return await stat(candidate, options as never);
  } catch (error) {
    const source = sourceForVirtualJavaScriptFile(candidate, error);
    if (source === null) {
      throw error;
    }
    return stat(source, options as never);
  }
}

function fileSystemPath(candidate: FsPath): string | null {
  if (typeof candidate === "string") {
    return candidate;
  }
  if (candidate instanceof URL) {
    return fileFromFileUrl(candidate.href);
  }
  return null;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}

function entryEmittedJavaScriptForSource(sourceFile: string): string | null {
  const entry = entryProject();
  if (entry === null || !isInsideDirectory(entry.emitBase, sourceFile)) {
    return null;
  }
  const mirrored = withJsExtension(
    path.join(entry.emitDir, path.relative(entry.emitBase, sourceFile)),
  );
  if (isActualFile(mirrored)) {
    return mirrored;
  }
  return resolveEmittedJavaScript({
    outDir: entry.emitDir,
    projectRoot: entry.emitBase,
    sourceFile,
  });
}

/** The internal CommonJS-loader surface `ttsx` patches for `require`. */
interface NodeCommonJsModule {
  _resolveFilename(
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: unknown,
  ): string;
  _extensions: Record<
    string,
    (
      module: { _compile(content: string, filename: string): unknown },
      filename: string,
    ) => void
  >;
}

/**
 * Map a relative `require` request the default resolver could not find onto the
 * source `.ts` it was compiled from, or `null` when it is non-relative, has no
 * usable parent, or matches nothing on disk.
 */
function sourceTypeScriptForRequest(
  request: string,
  parent: unknown,
): string | null {
  if (typeof request !== "string") {
    return null;
  }
  const absolute = sourceTypeScriptForAbsoluteJavaScript(request);
  if (absolute !== null) {
    return absolute;
  }
  if (!isRelativeSpecifier(request)) {
    return null;
  }
  const parentFile = (parent as { filename?: unknown } | null)?.filename;
  if (typeof parentFile !== "string" || !isTypeScriptSource(parentFile)) {
    return null;
  }
  const [pathPart] = splitSpecifierSuffix(request);
  const resolved = resolveSourcePathPart(pathPart, path.dirname(parentFile));
  return resolved === null ? null : fileFromFileUrl(resolved);
}

function sourceTypeScriptForAbsoluteJavaScript(request: string): string | null {
  return absoluteJavaScriptSourceCounterpart(request);
}

function sourceSpecifierFromAbsoluteJavaScript(
  specifier: string,
): string | null {
  const source = absoluteJavaScriptSourceCounterpart(specifier);
  return source === null ? null : pathToFileURL(source).href;
}

function absoluteJavaScriptSourceCounterpart(specifier: string): string | null {
  const [pathPart] = splitSpecifierSuffix(specifier);
  const target = pathPart.startsWith("file:")
    ? fileFromFileUrl(pathPart)
    : pathPart;
  if (!path.isAbsolute(target) || isFile(target)) {
    return null;
  }
  for (const candidate of typeScriptCounterparts(target)) {
    if (isFile(candidate)) {
      return candidate;
    }
  }
  return null;
}

function sourceSpecifierFromTypeScriptParent(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (
    parentURL === undefined ||
    !isTypeScriptUrl(parentURL) ||
    !isRelativeSpecifier(specifier)
  ) {
    return null;
  }
  const parentDir = path.dirname(fileFromFileUrl(parentURL));
  const [pathPart, suffix] = splitSpecifierSuffix(specifier);
  const resolved = resolveSourcePathPart(pathPart, parentDir);
  return resolved === null ? null : resolved + suffix;
}

/**
 * Serve a TypeScript source's compiled JavaScript as its module source, keeping
 * the source `.ts` URL as the module's identity. Everything else is left to the
 * default loader.
 */
export const load: LoadHookSync = (url, context, nextLoad) => {
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const file = fileFromFileUrl(url);
  if (!isTypeScriptSource(file)) {
    return nextLoad(url, context);
  }
  const runtime = runtimeJavaScriptForSource(file);
  return {
    format: runtime.format,
    shortCircuit: true,
    source: runtime.source,
  };
};

interface RuntimeJavaScript {
  readonly format: "module" | "commonjs";
  readonly source: string;
}

function runtimeJavaScriptForSource(sourceFile: string): RuntimeJavaScript {
  const realSourceFile = realpathIfExists(sourceFile);
  const compiled = compiledJavaScriptFor(realSourceFile);
  const source = fs.readFileSync(compiled, "utf8");
  const format = moduleFormat(sourceFile, source);
  return {
    format,
    source:
      format === "commonjs"
        ? restoreCommonJsImportBindings(realSourceFile, source)
        : source,
  };
}

interface CommonJsImportBinding {
  readonly imported: string | null;
  readonly local: string;
  readonly specifier: string;
}

interface CommonJsRequireBinding {
  readonly alias: string;
  readonly end: number;
}

const IDENTIFIER_SOURCE = "[A-Za-z_$][A-Za-z0-9_$]*";

/**
 * Native transforms can preserve source-local identifiers after tsgo has
 * rewritten the matching import into a CommonJS `require()` alias. Restore only
 * locals that are backed by a real emitted require and are not already declared
 * by the plugin output itself.
 */
function restoreCommonJsImportBindings(
  sourceFile: string,
  output: string,
): string {
  const bindings = restorableCommonJsImportBindings(sourceFile);
  if (bindings.length === 0) {
    return output;
  }
  const insertions = new Map<number, string[]>();
  const restoredLocals = new Set<string>();
  const syntax = javaScriptSyntaxView(output);
  for (const binding of bindings) {
    if (
      restoredLocals.has(binding.local) ||
      hasLocalBinding(syntax, binding.local)
    ) {
      continue;
    }
    const required = commonJsRequireBinding(output, binding.specifier);
    if (required === null) {
      continue;
    }
    const expression =
      binding.imported === null
        ? required.alias
        : `${required.alias}.${binding.imported}`;
    const line = `\nconst ${binding.local} = ${expression};`;
    insertions.set(required.end, [
      ...(insertions.get(required.end) ?? []),
      line,
    ]);
    restoredLocals.add(binding.local);
  }
  let restored = output;
  for (const [index, lines] of [...insertions].sort((a, b) => b[0] - a[0])) {
    restored =
      restored.slice(0, index) + lines.join("") + restored.slice(index);
  }
  return restored;
}

function restorableCommonJsImportBindings(
  sourceFile: string,
): CommonJsImportBinding[] {
  const source = readFileOrNull(sourceFile);
  if (source === null) {
    return [];
  }
  const syntax = javaScriptSyntaxView(source);
  const bindings: CommonJsImportBinding[] = [];
  const namedImport = new RegExp(
    String.raw`^\s*import\s+(?!type\b)(?:(${IDENTIFIER_SOURCE})\s*,\s*)?\{([^}]*)\}\s*from\s*(['"])([^'"]+)\3\s*;?`,
    "gm",
  );
  for (const match of source.matchAll(namedImport)) {
    if (!isExecutableImportMatch(syntax, match)) {
      continue;
    }
    const defaultLocal = match[1];
    const namedClause = match[2];
    const specifier = match[4];
    if (specifier === undefined) {
      continue;
    }
    if (defaultLocal !== undefined) {
      bindings.push({ imported: "default", local: defaultLocal, specifier });
    }
    if (namedClause === undefined) {
      continue;
    }
    bindings.push(...namedImportBindings(namedClause, specifier));
  }

  const defaultImport = new RegExp(
    String.raw`^\s*import\s+(?!type\b)(${IDENTIFIER_SOURCE})\s+from\s*(['"])([^'"]+)\2\s*;?`,
    "gm",
  );
  for (const match of source.matchAll(defaultImport)) {
    if (!isExecutableImportMatch(syntax, match)) {
      continue;
    }
    const local = match[1];
    const specifier = match[3];
    if (local !== undefined && specifier !== undefined) {
      bindings.push({ imported: "default", local, specifier });
    }
  }

  const defaultNamespaceImport = new RegExp(
    String.raw`^\s*import\s+(?!type\b)(${IDENTIFIER_SOURCE})\s*,\s*\*\s+as\s+(${IDENTIFIER_SOURCE})\s+from\s*(['"])([^'"]+)\3\s*;?`,
    "gm",
  );
  for (const match of source.matchAll(defaultNamespaceImport)) {
    if (!isExecutableImportMatch(syntax, match)) {
      continue;
    }
    const local = match[1];
    const namespaceLocal = match[2];
    const specifier = match[4];
    if (specifier !== undefined && local !== undefined) {
      bindings.push({ imported: "default", local, specifier });
    }
    if (specifier !== undefined && namespaceLocal !== undefined) {
      bindings.push({ imported: null, local: namespaceLocal, specifier });
    }
  }

  const namespaceImport = new RegExp(
    String.raw`^\s*import\s+(?!type\b)\*\s+as\s+(${IDENTIFIER_SOURCE})\s+from\s*(['"])([^'"]+)\2\s*;?`,
    "gm",
  );
  for (const match of source.matchAll(namespaceImport)) {
    if (!isExecutableImportMatch(syntax, match)) {
      continue;
    }
    const local = match[1];
    const specifier = match[3];
    if (local !== undefined && specifier !== undefined) {
      bindings.push({ imported: null, local, specifier });
    }
  }
  return bindings;
}

function isExecutableImportMatch(
  syntax: string,
  match: RegExpMatchArray,
): boolean {
  if (match.index === undefined) {
    return false;
  }
  return /^\s*import\b/.test(
    syntax.slice(match.index, match.index + match[0].length),
  );
}

function namedImportBindings(
  namedClause: string,
  specifier: string,
): CommonJsImportBinding[] {
  const bindings: CommonJsImportBinding[] = [];
  for (const raw of namedClause.split(",")) {
    const item = raw.trim();
    if (item === "" || item.startsWith("type ")) {
      continue;
    }
    const match = new RegExp(
      String.raw`^(${IDENTIFIER_SOURCE})(?:\s+as\s+(${IDENTIFIER_SOURCE}))?$`,
    ).exec(item);
    if (match === null) {
      continue;
    }
    const imported = match[1];
    const local = match[2] ?? imported;
    if (imported !== undefined && local !== undefined) {
      bindings.push({ imported, local, specifier });
    }
  }
  return bindings;
}

function commonJsRequireBinding(
  output: string,
  specifier: string,
): CommonJsRequireBinding | null {
  for (const candidate of commonJsRequireSpecifierCandidates(specifier)) {
    const binding = commonJsRequireBindingForSpecifier(output, candidate);
    if (binding !== null) {
      return binding;
    }
  }
  return null;
}

function commonJsRequireBindingForSpecifier(
  output: string,
  specifier: string,
): CommonJsRequireBinding | null {
  const syntax = javaScriptSyntaxView(output);
  const requireBinding = new RegExp(
    String.raw`^\s*(?:const|let|var)\s+(${IDENTIFIER_SOURCE})\s*=\s*(?:${IDENTIFIER_SOURCE}\(\s*)?require\(\s*["']${escapeRegExp(specifier)}["']\s*\)(?:\s*\))?\s*;?`,
    "gm",
  );
  for (const match of output.matchAll(requireBinding)) {
    if (!isExecutableRequireMatch(syntax, match)) {
      continue;
    }
    const alias = match[1];
    if (alias !== undefined && match.index !== undefined) {
      return { alias, end: match.index + match[0].length };
    }
  }
  return null;
}

function commonJsRequireSpecifierCandidates(specifier: string): string[] {
  const candidates = [specifier];
  const [pathPart, suffix] = splitSpecifierSuffix(specifier);
  const lower = pathPart.toLowerCase();
  if (lower.endsWith(".mts")) {
    candidates.push(pathPart.slice(0, -4) + ".mjs" + suffix);
  } else if (lower.endsWith(".cts")) {
    candidates.push(pathPart.slice(0, -4) + ".cjs" + suffix);
  } else if (lower.endsWith(".tsx")) {
    candidates.push(pathPart.slice(0, -4) + ".js" + suffix);
  } else if (lower.endsWith(".ts")) {
    candidates.push(pathPart.slice(0, -3) + ".js" + suffix);
  }
  return [...new Set(candidates)];
}

function isExecutableRequireMatch(
  syntax: string,
  match: RegExpMatchArray,
): boolean {
  if (match.index === undefined) {
    return false;
  }
  return /^\s*(?:const|let|var)\b/.test(
    syntax.slice(match.index, match.index + match[0].length),
  );
}

function hasLocalBinding(syntax: string, local: string): boolean {
  const escaped = escapeRegExp(local);
  return (
    new RegExp(
      String.raw`\b(?:const|let|var|function|class)\s+${escaped}\b`,
    ).test(syntax) ||
    new RegExp(String.raw`\b(?:const|let|var)\s*\{[^}]*\b${escaped}\b`).test(
      syntax,
    )
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The compiled JavaScript tsgo emitted for a `.ts` source.
 *
 * The compile gate compiles the entry PROGRAM — the entry's own sources AND any
 * source-consumed workspace dependency pulled into it — with the full program's
 * type context and plugin transforms. Any source the gate emitted is served
 * from there, so a transform that crosses package boundaries (e.g. a schema
 * over a type imported from a workspace package) sees every type, not just the
 * dependency's own narrower program. A source the gate did NOT emit — a
 * published `node_modules` package that ships raw `.ts` — is compiled on its
 * own. Throws a clear diagnostic when neither produces JavaScript for it.
 */
function compiledJavaScriptFor(sourceFile: string): string {
  const entry = entryProject();
  if (entry !== null) {
    // The gate lays a source's emit at `emitDir` + its position relative to the
    // source root. The root is mirrored under `emitDir` so this holds even for a
    // workspace dependency the program pulls in from ABOVE `rootDir` (whose
    // relative path begins with `..`), which `resolveEmittedJavaScript` declines
    // to map for being outside the project.
    const mirrored = withJsExtension(
      path.join(entry.emitDir, path.relative(entry.emitBase, sourceFile)),
    );
    if (isFile(mirrored)) {
      return mirrored;
    }
    if (isInsideDirectory(entry.emitBase, sourceFile)) {
      const emitted = resolveEmittedJavaScript({
        outDir: entry.emitDir,
        projectRoot: entry.emitBase,
        sourceFile,
      });
      if (emitted !== null) {
        return emitted;
      }
      return emittedLooseEntryFile(entry, sourceFile);
    }
  }
  const emitted = emittedDependencyFile(sourceFile);
  if (emitted === null) {
    throw new Error(
      `ttsx: ${sourceFile} is not inside any package, so its TypeScript ` +
        `cannot be compiled for execution`,
    );
  }
  return emitted;
}

/** Replace a TypeScript source extension with its JavaScript emit counterpart. */
function withJsExtension(filename: string): string {
  return filename.replace(/\.([cm]?)tsx?$/i, ".$1js");
}

/** The entry project's emit, passed by the launcher; `null` outside `ttsx`. */
interface EntryProject {
  /** Directory the gate's emit is laid out relative to (the project rootDir). */
  readonly emitBase: string;
  /** Directory the gate emitted the entry project's JavaScript into. */
  readonly emitDir: string;
  /** Entry project root, used for plugin resolution in loose runtime emits. */
  readonly root: string;
  /** Tsconfig the compile gate built, inherited by loose runtime emits. */
  readonly tsconfig: string;
}
let entryProjectCache: EntryProject | null | undefined;
function entryProject(): EntryProject | null {
  if (entryProjectCache === undefined) {
    const emitDir = process.env.TTSC_TTSX_ENTRY_EMIT_DIR;
    const emitBase = process.env.TTSC_TTSX_ENTRY_EMIT_BASE;
    const root = process.env.TTSC_TTSX_ENTRY_PROJECT_ROOT;
    const tsconfig = process.env.TTSC_TTSX_ENTRY_TSCONFIG;
    entryProjectCache =
      emitDir && emitBase && root && tsconfig
        ? {
            emitBase: realpathIfExists(emitBase),
            emitDir,
            root: realpathIfExists(root),
            tsconfig: realpathIfExists(tsconfig),
          }
        : null;
  }
  return entryProjectCache;
}

/** Runtime-only emits for entry-project sources reached outside the gate graph. */
const looseEntrySources = new Map<string, string>();

/**
 * Compile one entry-project source that the initial compile gate did not emit.
 *
 * Dynamic imports built from runtime strings are invisible to TypeScript's
 * program graph, so a file can live under the entry project's source boundary
 * while still being absent from the up-front gate output. Reuse the project's
 * tsconfig and plugins, but replace its input set with just the requested file
 * and emit into the private ttsx runtime directory.
 */
function emittedLooseEntryFile(
  entry: EntryProject,
  sourceFile: string,
): string {
  const cached = looseEntrySources.get(sourceFile);
  if (cached !== undefined) {
    return cached;
  }
  const fingerprint = createHash("sha1").update(sourceFile).digest("hex");
  const root = path.join(entry.emitDir, ".ttsx-loose", fingerprint);
  const outDir = path.join(root, "out");
  const tsconfig = writeLooseEntryTsconfig(entry, sourceFile, root, outDir);
  const result = runBuild({
    cacheDir: process.env.TTSC_TTSX_PLUGIN_CACHE_DIR,
    checkers: dependencyBuildCheckers(),
    cwd: entry.root,
    emit: true,
    outDir,
    passthrough: dependencyBuildPassthrough(
      { rootDir: entry.emitBase },
      entry.emitBase,
    ),
    plugins: process.env.TTSC_TTSX_NO_PLUGINS === "1" ? false : undefined,
    projectRoot: entry.root,
    quiet: true,
    singleThreaded: process.env.TTSC_TTSX_SINGLE_THREADED === "1",
    tsconfig,
  });
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new Error(
      `ttsx: failed to compile entry-project runtime source ${sourceFile} ` +
        `(tsgo exited with status ${result.status})` +
        (detail ? `\n${detail}` : " (no compiler output)"),
    );
  }
  const emitted = resolveEmittedJavaScript({
    emittedFiles: result.emittedFiles,
    outDir,
    projectRoot: entry.emitBase,
    sourceFile,
  });
  if (emitted === null) {
    throw new Error(
      `ttsx: ${sourceFile} belongs to the entry project but neither the ` +
        `compile gate nor the runtime single-file emit produced JavaScript`,
    );
  }
  looseEntrySources.set(sourceFile, emitted);
  return emitted;
}

function writeLooseEntryTsconfig(
  entry: EntryProject,
  sourceFile: string,
  root: string,
  outDir: string,
): string {
  fs.mkdirSync(root, { recursive: true });
  const tsconfig = path.join(root, "tsconfig.json");
  const content = JSON.stringify(
    {
      extends: relativeTsconfigPath(root, entry.tsconfig),
      compilerOptions: {
        declaration: false,
        declarationMap: false,
        emitDeclarationOnly: false,
        incremental: false,
        noEmit: false,
        outDir: toPosix(outDir),
        rootDir: toPosix(entry.emitBase),
        sourceMap: false,
      },
      files: [toPosix(sourceFile)],
    },
    null,
    2,
  );
  if (readFileOrNull(tsconfig) !== content) {
    fs.writeFileSync(tsconfig, content, "utf8");
  }
  return tsconfig;
}

function relativeTsconfigPath(fromDir: string, tsconfig: string): string {
  const relative = toPosix(path.relative(fromDir, tsconfig));
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/** A package's tsgo build outputs, keyed by its package root. */
interface BuiltProject {
  /** Per-package cache the package's `.ts` sources are served from. */
  readonly outDir: string;
  /** Directory the emit is laid out relative to (the project's `rootDir`). */
  readonly emitBase: string;
}
const builtProjects = new Map<string, BuiltProject>();

/**
 * Compile the package that owns `sourceFile` with tsgo (once per process,
 * cached) and return the emitted JavaScript for that file, or `null` when no
 * owning package is found.
 *
 * The package is built through its own `tsconfig` when it ships one; otherwise
 * a minimal config rooted at the package is synthesized, so a published package
 * that ships raw `.ts` with no config still compiles through the real
 * compiler.
 */
function emittedDependencyFile(sourceFile: string): string | null {
  const packageRoot = owningPackageRoot(sourceFile);
  if (packageRoot === null) {
    return null;
  }
  let built = builtProjects.get(packageRoot);
  if (built === undefined) {
    built = buildDependencyPackage(packageRoot);
    builtProjects.set(packageRoot, built);
  }
  const emitted = resolveEmittedJavaScript({
    outDir: built.outDir,
    projectRoot: built.emitBase,
    sourceFile,
  });
  if (emitted === null) {
    // The package built, but no emitted `.js` was found for this source — its
    // `tsconfig` may exclude the file, its `rootDir` may not contain it, or the
    // cache may be stale. Surface it (with the cache path to inspect or clear)
    // instead of letting Node fail loading the raw `.ts`.
    throw new Error(
      `ttsx: ${sourceFile} compiled as part of package ${packageRoot}, but no ` +
        `emitted JavaScript was found for it under ${built.outDir} (check the ` +
        `package's tsconfig include/exclude and rootDir, or clear that cache)`,
    );
  }
  return emitted;
}

/** Per-package cache directory holding the package's tsgo emit. */
function dependencyCacheDir(packageRoot: string): string {
  return path.join(packageRoot, "node_modules", ".cache", "ttsc", "ttsx-deps");
}

/** Filename of the freshness stamp written into a completed cache. */
const STAMP_FILE = ".ttsx-stamp.json";
let stagingCounter = 0;

/**
 * Build the package at `packageRoot` with tsgo and return where its emit lives.
 *
 * A full, type-checked build runs only when the per-package cache is stale; a
 * fresh cache (its stamp matches the current ttsc version, tsconfig, and source
 * mtimes) is reused as-is. The build emits into a private staging directory
 * that is promoted into place once complete, so concurrent `ttsx` processes
 * never observe a half-written cache and never corrupt one another's. Throws on
 * a non-zero build — a dependency's own type error must surface, not be
 * skipped.
 */
function buildDependencyPackage(packageRoot: string): BuiltProject {
  const outDir = dependencyCacheDir(packageRoot);
  const project = packageProject(packageRoot);
  const stamp = freshnessStamp(
    packageRoot,
    project.tsconfig,
    project.options,
    project.pluginBaseDirs,
  );
  if (readStamp(outDir) === stamp) {
    return { emitBase: project.emitBase, outDir };
  }
  const staging = `${outDir}.${process.pid}.${(stagingCounter += 1)}.staging`;
  try {
    fs.rmSync(staging, { force: true, recursive: true });
    const result = runBuild({
      cacheDir: process.env.TTSC_TTSX_PLUGIN_CACHE_DIR,
      checkers: dependencyBuildCheckers(),
      cwd: packageRoot,
      emit: true,
      outDir: staging,
      passthrough: dependencyBuildPassthrough(
        project.options,
        project.emitBase,
      ),
      plugins: process.env.TTSC_TTSX_NO_PLUGINS === "1" ? false : undefined,
      quiet: true,
      singleThreaded: process.env.TTSC_TTSX_SINGLE_THREADED === "1",
      tsconfig: project.tsconfig,
    });
    if (result.status !== 0) {
      const detail = (result.stderr || result.stdout || "").trim();
      throw new Error(
        `ttsx: failed to compile dependency package ${packageRoot} ` +
          `(tsgo exited with status ${result.status})` +
          (detail ? `\n${detail}` : " (no compiler output)"),
      );
    }
    // tsgo creates `staging` only as a side effect of emitting into it; a build
    // that legitimately emits nothing (e.g. every input is declaration-only)
    // succeeds without creating the directory, so ensure it exists before
    // stamping. The empty cache then promotes normally and the eventual
    // resolve gives the proper "no emitted JavaScript" diagnostic, rather than
    // crashing here with a raw ENOENT on the stamp write.
    fs.mkdirSync(staging, { recursive: true });
    fs.writeFileSync(path.join(staging, STAMP_FILE), stamp, "utf8");
    promoteDirectory(staging, outDir, stamp);
  } finally {
    fs.rmSync(staging, { force: true, recursive: true });
  }
  return { emitBase: project.emitBase, outDir };
}

/**
 * Resolve the tsconfig a package builds through and the directory its emit is
 * laid out relative to. A package's own config (at the package root) is
 * preferred; a package that ships none gets a minimal config synthesized into a
 * stable path beside the cache, with `bundler` resolution so the extensionless
 * relative imports raw sources tend to use still resolve. The synthesized file
 * is rewritten only when its content changes, so its mtime stays a reliable
 * freshness input.
 */
function packageProject(packageRoot: string): {
  tsconfig: string;
  emitBase: string;
  options: unknown;
  pluginBaseDirs: readonly string[];
} {
  const own = ownProjectConfig(packageRoot);
  if (own !== null) {
    return own;
  }
  const root = toPosix(packageRoot);
  const compilerOptions = {
    module: "preserve",
    moduleResolution: "bundler",
    rootDir: root,
    // The entry compile gate already type-checked this dependency in the
    // consuming program; this build only needs runnable emit, so library
    // declaration files are skipped.
    skipLibCheck: true,
    target: "esnext",
  };
  const content = JSON.stringify(
    {
      compilerOptions,
      include: [`${root}/**/*`],
      exclude: [`${root}/node_modules`],
    },
    null,
    2,
  );
  const dir = path.join(packageRoot, "node_modules", ".cache", "ttsc");
  fs.mkdirSync(dir, { recursive: true });
  const tsconfig = path.join(dir, "ttsx-deps.tsconfig.json");
  if (readFileOrNull(tsconfig) !== content) {
    fs.writeFileSync(tsconfig, content, "utf8");
  }
  return {
    emitBase: packageRoot,
    options: compilerOptions,
    pluginBaseDirs: [],
    tsconfig,
  };
}

/**
 * The package's own `tsconfig` (and its emit base) when one sits at the package
 * root, or `null` when the nearest config belongs to an ancestor — an ancestor
 * config must not be mistaken for the package's own build.
 */
function ownProjectConfig(packageRoot: string): {
  tsconfig: string;
  emitBase: string;
  options: unknown;
  pluginBaseDirs: readonly string[];
} | null {
  let project: ReturnType<typeof readProjectConfig>;
  try {
    project = readProjectConfig({ cwd: packageRoot });
  } catch (error) {
    // `readProjectConfig` throws both when no config exists anywhere up the
    // tree (the cue to synthesize one) and when a config that DOES exist is
    // unreadable. A broken config sitting at the package root is a real error
    // to surface, not a reason to silently build under a different, synthesized
    // config. `readProjectConfig` resolves both `tsconfig.json` and
    // `jsconfig.json`, so a broken one of either name is surfaced.
    const rootConfig = ["tsconfig.json", "jsconfig.json"].find((name) =>
      isFile(path.join(packageRoot, name)),
    );
    if (rootConfig !== undefined) {
      throw new Error(
        `ttsx: dependency package ${packageRoot} has an unreadable ` +
          `${rootConfig}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  }
  if (!samePath(project.root, packageRoot)) {
    return null;
  }
  return {
    emitBase: emitBaseDirectory(project),
    options: project.compilerOptions,
    pluginBaseDirs: project.pluginBaseDirs,
    tsconfig: project.path,
  };
}

/**
 * A string that changes whenever the cache must be rebuilt: the ttsc version
 * (emit logic), the resolved compiler options, the leaf tsconfig's identity and
 * mtime, and the package's full set of `.ts` sources with their mtimes. Hashing
 * the _resolved_ options catches a change in an `extends`-ed base config (a
 * base config lives outside the package and is never enumerated as a source);
 * also hashing the leaf tsconfig's mtime catches a change to a field the
 * resolved options omit — notably `include`/`exclude`/`files`, which change the
 * build's input set. Hashing the whole sorted source set — not just the newest
 * mtime — means a deleted or renamed source invalidates it as well, not only an
 * edited one. A completed cache stores this; a later run reuses it only on an
 * exact match.
 *
 * The source set walks the package's own directory tree. A package whose build
 * reaches `.ts` files OUTSIDE its own root — an `include`/`files` glob pointing
 * at a sibling directory, or an `extends`-base that itself declares `include` —
 * is the one case not covered: a content edit to such an out-of-tree input is
 * not seen here. That layout is an anti-pattern for a consumed package (its
 * sources should live under its own root), so the stamp does not pay to chase
 * it; fully closing it would require stamping the input set tsgo actually
 * reads.
 */
function freshnessStamp(
  packageRoot: string,
  tsconfig: string,
  options: unknown,
  pluginBaseDirs: readonly string[],
): string {
  const digest = createHash("sha1");
  digest.update(JSON.stringify(options ?? {}));
  for (const source of packageBuildInputs(
    packageRoot,
    tsconfig,
    options,
    pluginBaseDirs,
  )) {
    const stat = statFingerprint(source);
    digest.update(`\0${source}\0${stat.mtimeMs}\0${stat.size}`);
  }
  return JSON.stringify({
    version: ttscVersion(),
    digest: digest.digest("hex"),
  });
}

function dependencyBuildCheckers(): number | undefined {
  const raw = process.env.TTSC_TTSX_CHECKERS;
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function dependencyBuildPassthrough(
  options: unknown,
  emitBase: string,
): string[] | undefined {
  const raw = process.env.TTSC_TTSX_TSGO_FLAGS;
  const defaultRootDir = hasRootDirOption(options)
    ? []
    : ["--rootDir", emitBase];
  if (raw === undefined || raw.trim() === "") {
    return defaultRootDir.length === 0 ? undefined : defaultRootDir;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const passthrough =
      Array.isArray(parsed) &&
      parsed.every((item): item is string => typeof item === "string")
        ? parsed
        : undefined;
    return [...defaultRootDir, ...(passthrough ?? [])];
  } catch {
    return defaultRootDir.length === 0 ? undefined : defaultRootDir;
  }
}

function hasRootDirOption(options: unknown): boolean {
  return (
    isRecord(options) &&
    typeof options.rootDir === "string" &&
    options.rootDir.length !== 0
  );
}

/** Same filesystem path, case-insensitively on case-insensitive platforms. */
function samePath(a: string, b: string): boolean {
  const ra = path.resolve(a);
  const rb = path.resolve(b);
  return process.platform === "win32"
    ? ra.toLowerCase() === rb.toLowerCase()
    : ra === rb;
}

/** Read a cache's freshness stamp, or `null` when it is absent or unreadable. */
function readStamp(outDir: string): string | null {
  return readFileOrNull(path.join(outDir, STAMP_FILE));
}

/**
 * Move `staging` onto `outDir` as a complete unit. A plain rename wins when
 * `outDir` is absent.
 *
 * When `outDir` already exists, the common case under parallel `ttsx` processes
 * is that a peer promoted the _same_ build first — every process computes an
 * identical `stamp` from identical sources and options — so if the existing
 * cache already carries our stamp we keep it and discard `staging`, never
 * touching the live directory. Only a genuinely stale `outDir` is replaced, and
 * then the old copy is set aside (not deleted up front) and restored if the
 * swap-in fails, so a reader never loses a usable cache.
 */
function promoteDirectory(
  staging: string,
  outDir: string,
  stamp: string,
): void {
  fs.mkdirSync(path.dirname(outDir), { recursive: true });
  try {
    fs.renameSync(staging, outDir);
    return;
  } catch {
    // `outDir` already exists; decide whether it must be replaced.
  }
  if (readStamp(outDir) === stamp) {
    // A peer already promoted our exact build; keep theirs untouched.
    return;
  }
  const retired = `${outDir}.${process.pid}.${(stagingCounter += 1)}.retired`;
  try {
    fs.renameSync(outDir, retired);
  } catch {
    // A peer moved/replaced `outDir` first; leave whatever they put there.
    return;
  }
  try {
    fs.renameSync(staging, outDir);
  } catch {
    // The swap-in failed (e.g. a peer recreated `outDir`). Prefer whatever is
    // now in place; if nothing is, restore the cache we set aside rather than
    // leaving `outDir` missing.
    if (!fs.existsSync(outDir)) {
      try {
        fs.renameSync(retired, outDir);
      } catch {
        // A peer won the slot; nothing left to restore.
      }
    }
  }
  fs.rmSync(retired, { force: true, recursive: true });
}

/**
 * Enumerate files that can affect a package dependency build, skipping
 * `node_modules`.
 */
function packageBuildInputs(
  packageRoot: string,
  tsconfig: string,
  options: unknown,
  pluginBaseDirs: readonly string[],
): string[] {
  const out = new Set<string>();
  const stack = [packageRoot];
  addBuildInput(out, tsconfig);
  addExplicitPluginInputs(out, path.dirname(tsconfig), options, pluginBaseDirs);
  addAutoDiscoveredPluginInputs(out, packageRoot);
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".hg" ||
        entry.name === ".svn"
      ) {
        continue;
      }
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (entry.isFile() && isDependencyBuildInputFile(next)) {
        out.add(path.resolve(next));
      }
    }
  }
  return [...out].sort();
}

function addExplicitPluginInputs(
  out: Set<string>,
  tsconfigDir: string,
  options: unknown,
  pluginBaseDirs: readonly string[],
): void {
  const plugins = (options as { plugins?: unknown } | null)?.plugins;
  if (!Array.isArray(plugins)) {
    return;
  }
  for (const [index, plugin] of plugins.entries()) {
    if (typeof plugin !== "object" || plugin === null) {
      continue;
    }
    const baseDir = pluginBaseDirs[index] ?? tsconfigDir;
    const transform = (plugin as { transform?: unknown }).transform;
    if (typeof transform === "string" && transform.length !== 0) {
      const transformFile = resolvePluginTransformFile(transform, baseDir);
      if (transformFile !== null) {
        addBuildInput(out, transformFile);
        addPluginNativeInputs(
          out,
          owningPackageRoot(transformFile) ?? path.dirname(transformFile),
        );
      }
    }
    const configFile = (plugin as { configFile?: unknown }).configFile;
    if (typeof configFile !== "string" || configFile.trim() === "") {
      continue;
    }
    addBuildInput(
      out,
      path.isAbsolute(configFile)
        ? configFile
        : path.resolve(baseDir, configFile),
    );
  }
}

function addAutoDiscoveredPluginInputs(
  out: Set<string>,
  packageRoot: string,
): void {
  const manifest = readJsonRecord(path.join(packageRoot, "package.json"));
  if (manifest === null) {
    return;
  }
  for (const name of directDependencyNames(manifest)) {
    const packageJson = resolveDependencyPackageJson(name, packageRoot);
    if (packageJson === null) {
      continue;
    }
    const dependencyManifest = readJsonRecord(packageJson);
    const plugin = packagePluginConfig(dependencyManifest);
    if (plugin === "missing") {
      continue;
    }
    addBuildInput(out, packageJson);
    if (plugin === "invalid") {
      continue;
    }
    const pluginRoot = path.dirname(packageJson);
    const transform = resolvePluginTransformFile(
      plugin.transform,
      isRelativeSpecifier(plugin.transform) ? pluginRoot : packageRoot,
    );
    if (transform !== null) {
      addBuildInput(out, transform);
    }
    addPluginNativeInputs(out, pluginRoot);
  }
}

function directDependencyNames(manifest: Record<string, unknown>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const dependencies of [
    manifest.dependencies,
    manifest.devDependencies,
  ]) {
    if (!isRecord(dependencies)) {
      continue;
    }
    for (const name of Object.keys(dependencies)) {
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

function resolveDependencyPackageJson(
  name: string,
  packageRoot: string,
): string | null {
  const direct = path.join(packageRoot, "node_modules", ...name.split("/"));
  const directManifest = path.join(direct, "package.json");
  if (isFile(directManifest)) {
    return realpathIfExists(directManifest);
  }
  const packageJson = path.join(packageRoot, "package.json");
  const packageRequire = createRequire(packageJson);
  try {
    return realpathIfExists(packageRequire.resolve(`${name}/package.json`));
  } catch {
    try {
      const entry = packageRequire.resolve(name);
      return nearestPackageJson(entry);
    } catch {
      return null;
    }
  }
}

function nearestPackageJson(location: string): string | null {
  let directory: string;
  try {
    const stat = fs.statSync(location);
    directory = stat.isDirectory() ? location : path.dirname(location);
  } catch {
    directory = path.dirname(location);
  }
  while (true) {
    const manifest = path.join(directory, "package.json");
    if (isFile(manifest)) {
      return realpathIfExists(manifest);
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

function packagePluginConfig(
  manifest: Record<string, unknown> | null,
): { transform: string } | "invalid" | "missing" {
  const ttsc = manifest?.ttsc;
  if (!isRecord(ttsc) || !("plugin" in ttsc)) {
    return "missing";
  }
  const plugin = ttsc.plugin;
  if (!isRecord(plugin) || Array.isArray(plugin)) {
    return "invalid";
  }
  const transform = plugin.transform;
  return typeof transform === "string" && transform.length !== 0
    ? { transform }
    : "invalid";
}

function resolvePluginTransformFile(
  transform: string,
  baseDir: string,
): string | null {
  try {
    return realpathIfExists(
      isRelativeSpecifier(transform)
        ? require.resolve(path.resolve(baseDir, transform))
        : require.resolve(transform, { paths: [baseDir] }),
    );
  } catch {
    return null;
  }
}

function addPluginNativeInputs(out: Set<string>, pluginRoot: string): void {
  let inputs = pluginNativeInputCache.get(pluginRoot);
  if (inputs === undefined) {
    const collected = new Set<string>();
    collectBuildInput(collected, path.join(pluginRoot, "go.mod"));
    collectBuildInput(collected, path.join(pluginRoot, "go.sum"));
    for (const directory of ["native", "driver", "plugin", "go-plugin"]) {
      collectGoBuildInputs(collected, path.join(pluginRoot, directory));
    }
    inputs = [...collected].sort();
    pluginNativeInputCache.set(pluginRoot, inputs);
  }
  for (const input of inputs) {
    out.add(input);
  }
}

function collectBuildInput(out: Set<string>, file: string): void {
  if (isFile(file)) {
    out.add(path.resolve(file));
  }
}

function collectGoBuildInputs(out: Set<string>, root: string): void {
  const stack = [root];
  while (stack.length !== 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".hg" ||
        entry.name === ".svn"
      ) {
        continue;
      }
      const next = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(next);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".go") ||
          entry.name === "go.mod" ||
          entry.name === "go.sum")
      ) {
        out.add(path.resolve(next));
      }
    }
  }
}

function addBuildInput(out: Set<string>, file: string): void {
  if (isFile(file)) {
    out.add(path.resolve(file));
  }
}

function isDependencyBuildInputFile(file: string): boolean {
  const basename = path.basename(file).toLowerCase();
  if (basename === "package.json") {
    return true;
  }
  if (/^(?:ts|js)config(?:\..*)?\.json$/i.test(basename)) {
    return true;
  }
  if (isTypeScriptBuildInput(file)) {
    return true;
  }
  return CONFIG_EXTENSIONS.some((extension) =>
    basename.endsWith(`.config${extension}`),
  );
}

let cachedTtscVersion: string | undefined;
function ttscVersion(): string {
  if (cachedTtscVersion === undefined) {
    try {
      const manifest = path.join(__dirname, "..", "..", "..", "package.json");
      cachedTtscVersion = String(
        (JSON.parse(fs.readFileSync(manifest, "utf8")) as { version?: unknown })
          .version ?? "0",
      );
    } catch {
      cachedTtscVersion = "0";
    }
  }
  return cachedTtscVersion;
}

function statFingerprint(file: string): { mtimeMs: number; size: number } {
  try {
    const stat = fs.statSync(file);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return { mtimeMs: 0, size: 0 };
  }
}

function readFileOrNull(file: string): string | null {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function readJsonRecord(file: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalize a filesystem path to forward slashes for use in tsconfig globs. */
function toPosix(filename: string): string {
  return filename.split(path.sep).join("/");
}

/**
 * The directory tsgo lays its emit out relative to: the project's explicit
 * `rootDir`, or the project root when none is configured.
 * `resolveEmittedJavaScript` mirrors a source's position under this directory
 * into the `outDir`.
 */
function emitBaseDirectory(
  project: ReturnType<typeof readProjectConfig>,
): string {
  const rootDir = project.compilerOptions.rootDir;
  if (typeof rootDir === "string") {
    return path.isAbsolute(rootDir)
      ? rootDir
      : path.resolve(project.root, rootDir);
  }
  return project.root;
}

/**
 * Nearest ancestor directory of `file` (inclusive of its own) holding a
 * `package.json`.
 */
function owningPackageRoot(file: string): string | null {
  let directory = path.dirname(file);
  while (true) {
    if (isFile(path.join(directory, "package.json"))) {
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return null;
    }
    directory = parent;
  }
}

/**
 * Rescue a relative specifier whose default resolution failed by mapping it
 * onto the source tree: a compiler-emitted `./x.js` (`.mjs`/`.cjs`) back to its
 * `./x.ts` (`.mts`/`.cts`) source, a concrete `.ts` Node refused, or an
 * extensionless `./x` to `./x.ts`/a directory index. Returns a `file:` URL for
 * the first on-disk match, or `null` (so the original error stands) when the
 * specifier is non-relative, has no usable parent, or matches nothing.
 */
function rescueSourceSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  const absolute = sourceSpecifierFromAbsoluteJavaScript(specifier);
  if (absolute !== null) {
    return absolute;
  }
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  if (parentURL === undefined || !parentURL.startsWith("file:")) {
    return null;
  }
  const parentDir = path.dirname(fileFromFileUrl(parentURL));
  // A `?query`/`#hash` suffix participates in module identity but not in file
  // resolution, so split it off, resolve the path, and re-attach it to the URL.
  const [pathPart, suffix] = splitSpecifierSuffix(specifier);
  const resolved = resolveSourcePathPart(pathPart, parentDir);
  return resolved === null ? null : resolved + suffix;
}

/** Resolve a relative specifier's path part to a `file:` URL on the source tree. */
function resolveSourcePathPart(
  pathPart: string,
  parentDir: string,
): string | null {
  if (hasConcreteExtension(pathPart)) {
    const target = path.resolve(parentDir, pathPart);
    // A `.js`/`.mjs`/`.cjs` the compiler emitted for a `.ts` source: try the
    // TypeScript counterpart(s) on disk.
    for (const candidate of typeScriptCounterparts(target)) {
      if (isFile(candidate)) {
        return pathToFileURL(candidate).href;
      }
    }
    // A concrete `.ts` (or a real `.js`) Node's resolver refused: accept it if
    // it actually exists.
    return isFile(target) ? pathToFileURL(target).href : null;
  }
  const base = path.resolve(parentDir, pathPart);
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = base + extension;
    if (isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  for (const extension of RESOLVABLE_EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (isFile(candidate)) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

/** Split a specifier into its path part and a `?query`/`#hash` suffix. */
function splitSpecifierSuffix(specifier: string): [string, string] {
  const match = /[?#]/.exec(specifier);
  return match === null
    ? [specifier, ""]
    : [specifier.slice(0, match.index), specifier.slice(match.index)];
}

/** The TypeScript source filenames a JavaScript emit extension maps back to. */
function typeScriptCounterparts(target: string): string[] {
  const lower = target.toLowerCase();
  if (lower.endsWith(".mjs")) {
    return [target.slice(0, -4) + ".mts"];
  }
  if (lower.endsWith(".cjs")) {
    return [target.slice(0, -4) + ".cts"];
  }
  if (lower.endsWith(".jsx")) {
    return [target.slice(0, -4) + ".tsx"];
  }
  if (lower.endsWith(".js")) {
    const stem = target.slice(0, -3);
    return [stem + ".ts", stem + ".tsx"];
  }
  return [];
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

/** True when `specifier` already carries an extension Node can load directly. */
function hasConcreteExtension(specifier: string): boolean {
  return /\.(?:[cm]?jsx?|json|node|[cm]?tsx?)$/i.test(specifier);
}

/** True when a resolved `file:` URL points at a TypeScript source. */
function isTypeScriptUrl(url: string | undefined): boolean {
  return (
    url !== undefined &&
    url.startsWith("file:") &&
    isTypeScriptSource(fileFromFileUrl(url))
  );
}

/** The filesystem path of a `file:` URL, ignoring any `?query`/`#hash`. */
function fileFromFileUrl(url: string): string {
  const parsed = new URL(url);
  parsed.search = "";
  parsed.hash = "";
  return fileURLToPath(parsed);
}

function isTypeScriptSource(filename: string): boolean {
  // Declaration files carry no runtime emit; they are never a runtime module,
  // so they are not ours to serve.
  if (/\.d\.[cm]?ts$/i.test(filename)) {
    return false;
  }
  const lower = filename.toLowerCase();
  return TYPESCRIPT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isTypeScriptBuildInput(filename: string): boolean {
  const lower = filename.toLowerCase();
  return TYPESCRIPT_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/**
 * The module format Node should run a served TypeScript source as. `.mts` and
 * `.cts` are authoritative by extension. For `.ts`/`.tsx`, the emitted
 * JavaScript wins when it clearly declares a format: ttsx runs the compiler's
 * bytes, so CommonJS emit must not be mislabeled as ESM just because the
 * package has `"type": "module"`.
 *
 * Package `type` is only the fallback for syntax-neutral emit.
 */
function moduleFormat(file: string, compiled: string): "module" | "commonjs" {
  const lower = file.toLowerCase();
  if (lower.endsWith(".mts")) {
    return "module";
  }
  if (lower.endsWith(".cts")) {
    return "commonjs";
  }
  const syntax = javaScriptSyntaxView(compiled);
  if (looksLikeCommonJS(syntax)) {
    return "commonjs";
  }
  if (looksLikeESM(syntax)) {
    return "module";
  }
  const packageType = nearestPackageType(file);
  if (packageType === "module") {
    return "module";
  }
  if (packageType === "commonjs") {
    return "commonjs";
  }
  return "commonjs";
}

/**
 * Heuristic: classify emitted JS as ESM when it carries an ESM-only marker — a
 * top-level `import`/`export` statement or `import.meta`. `require()` is not a
 * CommonJS signal here: ESM may legally create one via `createRequire`.
 */
function looksLikeESM(output: string): boolean {
  return (
    /^\s*(?:import|export)\s/m.test(output) ||
    /\bimport\s*\.\s*meta\b/.test(output)
  );
}

/**
 * Heuristic: classify emitted JS as CommonJS when it carries the markers tsgo
 * writes for CommonJS emit.
 */
function looksLikeCommonJS(output: string): boolean {
  return (
    /\bObject\.defineProperty\(exports\b/.test(output) ||
    /\bmodule\.exports\b/.test(output) ||
    /\bexports\./.test(output)
  );
}

/**
 * A JavaScript view that keeps executable code intact but masks strings,
 * comments, regex literals, and template raw text. Module-format probes are
 * intentionally lexical: `exports.foo` in a string is not CommonJS emit, and
 * `import.meta` in a regex is not ESM syntax.
 */
function javaScriptSyntaxView(source: string): string {
  const out = source.split("");

  const mask = (index: number): void => {
    if (out[index] !== "\n" && out[index] !== "\r") {
      out[index] = " ";
    }
  };

  const maskQuoted = (index: number, quote: string): number => {
    mask(index);
    for (let i = index + 1; i < source.length; i += 1) {
      mask(i);
      if (source[i] === "\\") {
        i += 1;
        if (i < source.length) {
          mask(i);
        }
      } else if (source[i] === quote) {
        return i + 1;
      }
    }
    return source.length;
  };

  const maskLineComment = (index: number): number => {
    let i = index;
    for (; i < source.length && source[i] !== "\n"; i += 1) {
      mask(i);
    }
    return i;
  };

  const maskBlockComment = (index: number): number => {
    mask(index);
    mask(index + 1);
    for (let i = index + 2; i < source.length; i += 1) {
      mask(i);
      if (source[i] === "*" && source[i + 1] === "/") {
        mask(i + 1);
        return i + 2;
      }
    }
    return source.length;
  };

  const maskRegex = (index: number): number => {
    mask(index);
    let inClass = false;
    for (let i = index + 1; i < source.length; i += 1) {
      mask(i);
      if (source[i] === "\\") {
        i += 1;
        if (i < source.length) {
          mask(i);
        }
      } else if (source[i] === "[") {
        inClass = true;
      } else if (source[i] === "]") {
        inClass = false;
      } else if (source[i] === "/" && !inClass) {
        let j = i + 1;
        while (/[A-Za-z]/.test(source[j] ?? "")) {
          mask(j);
          j += 1;
        }
        return j;
      } else if (source[i] === "\n" || source[i] === "\r") {
        return i;
      }
    }
    return source.length;
  };

  const maskTemplate = (index: number): number => {
    mask(index);
    for (let i = index + 1; i < source.length; i += 1) {
      if (source[i] === "\\") {
        mask(i);
        i += 1;
        if (i < source.length) {
          mask(i);
        }
      } else if (source[i] === "`") {
        mask(i);
        return i + 1;
      } else if (source[i] === "$" && source[i + 1] === "{") {
        mask(i);
        mask(i + 1);
        const close = scanCode(i + 2, true);
        if (close >= source.length || source[close] !== "}") {
          return close;
        }
        mask(close);
        i = close;
      } else {
        mask(i);
      }
    }
    return source.length;
  };

  const previousSignificantToken = (index: number): string | undefined => {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (!/\s/.test(out[i] ?? "")) {
        if (isIdentifierPart(out[i] ?? "")) {
          let start = i;
          while (start > 0 && isIdentifierPart(out[start - 1] ?? "")) {
            start -= 1;
          }
          return out.slice(start, i + 1).join("");
        }
        return out[i];
      }
    }
    return undefined;
  };

  const canStartRegex = (index: number): boolean => {
    const previous = previousSignificantToken(index);
    return (
      previous === undefined ||
      REGEX_PREFIX_KEYWORDS.has(previous) ||
      /[({[=,:;!?&|+\-*~^<>%]/.test(previous)
    );
  };

  function scanCode(index: number, stopAtBrace: boolean): number {
    let i = index;
    let braceDepth = 0;
    while (i < source.length) {
      const char = source[i];
      if (stopAtBrace && char === "}") {
        if (braceDepth === 0) {
          return i;
        }
        braceDepth -= 1;
        i += 1;
      } else if (stopAtBrace && char === "{") {
        braceDepth += 1;
        i += 1;
      } else if (char === "'" || char === '"') {
        i = maskQuoted(i, char);
      } else if (char === "`") {
        i = maskTemplate(i);
      } else if (char === "/" && source[i + 1] === "/") {
        i = maskLineComment(i);
      } else if (char === "/" && source[i + 1] === "*") {
        i = maskBlockComment(i);
      } else if (char === "/" && canStartRegex(i)) {
        i = maskRegex(i);
      } else {
        i += 1;
      }
    }
    return i;
  }

  scanCode(0, false);
  return out.join("");
}

const REGEX_PREFIX_KEYWORDS = new Set([
  "await",
  "case",
  "delete",
  "do",
  "else",
  "in",
  "of",
  "return",
  "throw",
  "typeof",
  "void",
  "yield",
]);

function isIdentifierPart(value: string): boolean {
  return /[A-Za-z0-9_$]/.test(value);
}

/** Package-type cache keyed by directory, mirroring Node's lookup walk. */
const packageTypeCache = new Map<string, "module" | "commonjs" | "none">();

function nearestPackageType(file: string): "module" | "commonjs" | "none" {
  let directory = path.dirname(file);
  const chain: string[] = [];
  while (true) {
    const cached = packageTypeCache.get(directory);
    if (cached !== undefined) {
      return rememberPackageType(chain, cached);
    }
    chain.push(directory);
    const type = readPackageType(directory);
    if (type !== null) {
      return rememberPackageType(chain, type);
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return rememberPackageType(chain, "none");
    }
    directory = parent;
  }
}

function rememberPackageType(
  directories: readonly string[],
  type: "module" | "commonjs" | "none",
): "module" | "commonjs" | "none" {
  for (const directory of directories) {
    packageTypeCache.set(directory, type);
  }
  return type;
}

function readPackageType(
  directory: string,
): "module" | "commonjs" | "none" | null {
  const manifest = path.join(directory, "package.json");
  if (!isFile(manifest)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      type?: unknown;
    };
    return parsed.type === "module"
      ? "module"
      : parsed.type === "commonjs"
        ? "commonjs"
        : "none";
  } catch {
    return "none";
  }
}

/** True when `file` is a descendant of directory `root` (not `root` itself). */
function isInsideDirectory(root: string, file: string): boolean {
  const [a, b] =
    process.platform === "win32"
      ? [root.toLowerCase(), file.toLowerCase()]
      : [root, file];
  const relative = path.relative(a, b);
  return (
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
  );
}

function realpathIfExists(filename: string): string {
  try {
    return nativeFs.realpathSync(filename);
  } catch {
    return filename;
  }
}

function isFile(candidate: string): boolean {
  return isActualFile(candidate);
}

function isActualFile(candidate: string): boolean {
  try {
    return nativeFs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isActualDirectory(candidate: string): boolean {
  try {
    return nativeFs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function isJavaScriptOutputFile(candidate: string): boolean {
  return /\.(?:[cm]?js)$/i.test(candidate);
}
