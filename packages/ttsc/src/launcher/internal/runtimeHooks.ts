import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Node.js module-customization hooks registered inside the child process that
 * `ttsx` spawns. They give the runtime the same whole-graph reach `tsx` has,
 * without weakening the compile gate: type-checking still happens up front in
 * `prepareExecution`'s tsgo build, and these hooks only affect how dependencies
 * are _loaded_ at runtime.
 *
 * - `resolve` rescues extensionless relative imports anywhere in the graph (e.g.
 *   a workspace dependency exporting raw `.ts` whose own sources use `import
 *   "./foo"`), which Node's ESM resolver rejects.
 * - `load` transpiles raw `.ts` dependencies that live under `node_modules`,
 *   where Node refuses to strip types at all.
 *
 * Workspace neighbours (realpath outside `node_modules`) keep Node's native
 * type-stripping path, so they stay covered by the up-front compile gate.
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

/** TypeScript source extensions the `load` hook transpiles under node_modules. */
const TYPESCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;

interface ResolveContext {
  readonly parentURL?: string;
  readonly conditions?: readonly string[];
  readonly importAttributes?: Record<string, string>;
}

interface ResolveResult {
  readonly url: string;
  readonly format?: string | null;
  readonly shortCircuit?: boolean;
}

interface LoadContext {
  readonly format?: string | null;
  readonly conditions?: readonly string[];
  readonly importAttributes?: Record<string, string>;
}

interface LoadResult {
  readonly format: string;
  readonly source?: string | Uint8Array;
  readonly shortCircuit?: boolean;
}

type NextResolve = (
  specifier: string,
  context: ResolveContext,
) => Promise<ResolveResult>;

type NextLoad = (url: string, context: LoadContext) => Promise<LoadResult>;

/**
 * Rescue an extensionless relative specifier that Node's ESM resolver rejected.
 *
 * Node resolves the common cases itself; this hook only runs after
 * `nextResolve` throws, so a successful resolution is never perturbed. When the
 * throwing specifier is relative, the candidate extensions are probed against
 * the parent's directory and the first existing file (or directory index) wins.
 * A genuinely missing module finds no candidate and the original error is
 * rethrown, preserving `ERR_MODULE_NOT_FOUND`.
 */
export async function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
): Promise<ResolveResult> {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const rescued = probeRelativeSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    return { shortCircuit: true, url: rescued };
  }
}

/**
 * Transpile a raw `.ts` dependency that lives under `node_modules`.
 *
 * Node strips types for first-party `.ts` automatically but refuses to do so
 * under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). This
 * hook performs the same type-strip transform for those files, scoped strictly
 * to `node_modules` so workspace neighbours keep Node's native path.
 */
export async function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad,
): Promise<LoadResult> {
  const filename = transpilableNodeModulesPath(url);
  if (filename === null) {
    return nextLoad(url, context);
  }
  const source = transpile(filename);
  return {
    format: moduleFormat(filename, source),
    shortCircuit: true,
    source,
  };
}

/**
 * Probe candidate extensions for a relative `specifier` whose bare form failed
 * to resolve. Returns a `file:` URL string for the first match, or `null` when
 * the specifier is non-relative, has no usable parent, or matches nothing.
 */
function probeRelativeSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (!isRelativeSpecifier(specifier)) {
    return null;
  }
  if (parentURL === undefined || !parentURL.startsWith("file:")) {
    return null;
  }
  if (hasConcreteExtension(specifier)) {
    return null;
  }
  const parentDir = path.dirname(fileURLToPath(parentURL));
  const base = path.resolve(parentDir, specifier);
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

/**
 * Return the filesystem path of a `file:` URL when it points at a TypeScript
 * source under `node_modules`, otherwise `null`. Both conditions must hold for
 * the `load` hook to take over: workspace `.ts` (outside `node_modules`) and
 * already-JavaScript files fall through to Node.
 */
function transpilableNodeModulesPath(url: string): string | null {
  if (!url.startsWith("file:")) {
    return null;
  }
  const filename = fileURLToPath(url);
  if (!isTypeScriptSource(filename) || !isUnderNodeModules(filename)) {
    return null;
  }
  return filename;
}

/**
 * Strip TypeScript types from `filename`, transforming TS-only constructs
 * (enums, namespaces, parameter properties) so the result is runnable
 * JavaScript. No transpile cache is kept: Node caches every module by resolved
 * URL, so each dependency file reaches this hook at most once per run.
 */
function transpile(filename: string): string {
  return stripTypeScriptTypes(fs.readFileSync(filename, "utf8"), {
    mode: "transform",
    sourceUrl: pathToFileURL(filename).href,
  });
}

/**
 * Decide the module format for a transpiled `node_modules` TypeScript file.
 *
 * Type-stripping never rewrites module syntax, so the emitted `source` keeps
 * whatever `import`/`export` or `require` form the author wrote. The format
 * must match that syntax or Node mis-parses the module. The extension is
 * authoritative for `.mts`/`.cts`; otherwise the nearest `package.json` `type`
 * sets the baseline, but unambiguous ESM syntax overrides a CommonJS baseline
 * exactly as Node's own module-syntax detection does.
 */
function moduleFormat(filename: string, source: string): string {
  if (filename.endsWith(".mts")) {
    return "module";
  }
  if (filename.endsWith(".cts")) {
    return "commonjs";
  }
  if (nearestPackageType(filename) === "module") {
    return "module";
  }
  return hasEsmSyntax(source) ? "module" : "commonjs";
}

/** True when `source` carries a top-level `import`/`export` statement. */
function hasEsmSyntax(source: string): boolean {
  return /(?:^|[\n;])\s*(?:import|export)\b/.test(source);
}

/** Package-type cache keyed by directory, mirroring Node's own lookup walk. */
const packageTypeCache = new Map<string, "module" | "commonjs">();

function nearestPackageType(filename: string): "module" | "commonjs" {
  let directory = path.dirname(filename);
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
      return rememberPackageType(chain, "commonjs");
    }
    directory = parent;
  }
}

function rememberPackageType(
  directories: readonly string[],
  type: "module" | "commonjs",
): "module" | "commonjs" {
  for (const directory of directories) {
    packageTypeCache.set(directory, type);
  }
  return type;
}

/** Read a directory's `package.json` `type`, or `null` when absent/invalid. */
function readPackageType(directory: string): "module" | "commonjs" | null {
  const manifest = path.join(directory, "package.json");
  if (!isFile(manifest)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      type?: unknown;
    };
    return parsed.type === "module" ? "module" : "commonjs";
  } catch {
    return "commonjs";
  }
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

/** True when `specifier` already carries an extension Node can load directly. */
function hasConcreteExtension(specifier: string): boolean {
  return /\.(?:[cm]?jsx?|json|node|[cm]?tsx?)$/i.test(specifier);
}

function isTypeScriptSource(filename: string): boolean {
  return TYPESCRIPT_EXTENSIONS.some((extension) =>
    filename.endsWith(extension),
  );
}

function isUnderNodeModules(filename: string): boolean {
  return filename.split(path.sep).includes("node_modules");
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}
