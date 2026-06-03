import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolveOwnerTsconfig } from "./ownerTsconfig";
import { emitSync } from "./syncEmit";

/**
 * Synchronous module hooks that make `ttsx` the ts-node it should be: every
 * TypeScript source — entry, workspace neighbour, or raw `.ts` dependency — is
 * emitted on demand through its owning project's program (full transform, not
 * type-stripping), and Node loads the result. `registerHooks` covers both the
 * ESM `import` graph and CommonJS `require`, so namespaces, plugins, and CJS
 * dependencies all work without an up-front gate or a byte store.
 *
 * - `resolve` rescues extensionless relative specifiers (and bare `.ts`) that
 *   Node's resolver rejects, so `import "./foo"` finds `./foo.ts`.
 * - `load` emits each `.ts` through the host and returns the JavaScript with the
 *   module format Node would assign the file.
 */

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;
const PROBE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
] as const;

interface ResolveContext {
  parentURL?: string;
  conditions?: readonly string[];
  importAttributes?: Record<string, string>;
}
interface ResolveResult {
  url: string;
  shortCircuit?: boolean;
}
interface LoadContext {
  format?: string | null;
}
interface LoadResult {
  format: "module" | "commonjs";
  source?: string | Uint8Array;
  shortCircuit?: boolean;
}

/** The entry's tsconfig, used when a file has no nearer owning tsconfig. */
let fallbackTsconfig = "";

/** Install the hooks. `entryTsconfig` owns files with no nearer tsconfig. */
export function installHooks(entryTsconfig: string): void {
  fallbackTsconfig = entryTsconfig;
  // `@types/node` types the sync hooks with a Promise-returning `next*` (shared
  // with the async loader); these hooks are strictly synchronous, so the
  // structurally-equivalent functions are passed through a cast.
  registerHooks({ resolve, load } as unknown as Parameters<
    typeof registerHooks
  >[0]);
}

function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: (s: string, c?: ResolveContext) => ResolveResult,
): ResolveResult {
  try {
    return nextResolve(specifier, context);
  } catch (error) {
    const rescued = probeRelativeSpecifier(specifier, context.parentURL);
    if (rescued === null) {
      throw error;
    }
    return { url: rescued, shortCircuit: true };
  }
}

function load(
  url: string,
  context: LoadContext,
  nextLoad: (u: string, c?: LoadContext) => LoadResult,
): LoadResult {
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const file = fileURLToPath(url);
  if (!isTypeScriptSource(file)) {
    return nextLoad(url, context);
  }
  const tsconfig = resolveOwnerTsconfig(file) ?? fallbackTsconfig;
  const emitted = emitSync({ tsconfig, file });
  // Rewrite relative specifiers to the resolved on-disk extension. Node's
  // ESM→CJS translator resolves a `require("./x")` against the classic CJS
  // resolver, which never finds `./x.ts`; spelling the extension makes the
  // path an exact file match the `load` hook then emits. Bare specifiers keep
  // going through `resolve`.
  const source = rewriteRelativeSpecifiers(emitted, file);
  return { format: moduleFormat(file), shortCircuit: true, source };
}

/**
 * Append the resolved extension to relative, extensionless module specifiers in
 * emitted code (`require("./x")`, `from "./x"`, `import("./x")`). Probing the
 * file's own directory mirrors `resolve`, so a specifier that resolves to a
 * directory index or a `.ts` sibling becomes a concrete path Node can load
 * without the classic resolver guessing.
 */
function rewriteRelativeSpecifiers(code: string, file: string): string {
  const dir = path.dirname(file);
  const pattern =
    /(\brequire\(\s*|\bimport\(\s*|\bfrom\s+)(["'])(\.\.?\/[^"']*)\2/g;
  return code.replace(pattern, (match, head: string, quote: string, spec: string) => {
    if (hasConcreteExtension(spec)) {
      return match;
    }
    const resolved = probeRelative(dir, spec);
    return resolved === null ? match : `${head}${quote}${resolved}${quote}`;
  });
}

/** Resolve a relative specifier to a `./`-prefixed path with extension, or null. */
function probeRelative(fromDir: string, specifier: string): string | null {
  const base = path.resolve(fromDir, specifier);
  for (const extension of PROBE_EXTENSIONS) {
    if (isFile(base + extension)) {
      return toRelativeSpecifier(fromDir, base + extension);
    }
  }
  for (const extension of PROBE_EXTENSIONS) {
    const indexed = path.join(base, `index${extension}`);
    if (isFile(indexed)) {
      return toRelativeSpecifier(fromDir, indexed);
    }
  }
  return null;
}

function toRelativeSpecifier(fromDir: string, target: string): string {
  let rel = path.relative(fromDir, target).split(path.sep).join("/");
  if (!rel.startsWith(".")) {
    rel = `./${rel}`;
  }
  return rel;
}

/**
 * Probe candidate extensions for a relative specifier Node could not resolve.
 * Returns a `file:` URL for the first match, or null when the specifier is not
 * relative, already has an extension, has no usable parent, or matches nothing.
 */
function probeRelativeSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (!isRelativeSpecifier(specifier) || hasConcreteExtension(specifier)) {
    return null;
  }
  if (parentURL === undefined || !parentURL.startsWith("file:")) {
    return null;
  }
  const base = path.resolve(path.dirname(fileURLToPath(parentURL)), specifier);
  for (const extension of PROBE_EXTENSIONS) {
    if (isFile(base + extension)) {
      return pathToFileURL(base + extension).href;
    }
  }
  for (const extension of PROBE_EXTENSIONS) {
    const indexed = path.join(base, `index${extension}`);
    if (isFile(indexed)) {
      return pathToFileURL(indexed).href;
    }
  }
  return null;
}

/**
 * The module format Node assigns a TypeScript source: `.mts` is ESM, `.cts` is
 * CommonJS, and `.ts`/`.tsx` follow the nearest package.json `type`. This
 * matches the module kind tsgo emitted the file as, so the loaded JavaScript is
 * interpreted correctly.
 */
function moduleFormat(file: string): "module" | "commonjs" {
  if (file.endsWith(".mts")) {
    return "module";
  }
  if (file.endsWith(".cts")) {
    return "commonjs";
  }
  return nearestPackageType(file) === "module" ? "module" : "commonjs";
}

const packageTypeCache = new Map<string, "module" | "commonjs">();

function nearestPackageType(file: string): "module" | "commonjs" {
  let dir = path.dirname(file);
  for (;;) {
    const cached = packageTypeCache.get(dir);
    if (cached !== undefined) {
      return cached;
    }
    const manifest = path.join(dir, "package.json");
    if (isFile(manifest)) {
      const type = readPackageType(manifest);
      packageTypeCache.set(dir, type);
      return type;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      packageTypeCache.set(dir, "commonjs");
      return "commonjs";
    }
    dir = parent;
  }
}

function readPackageType(manifest: string): "module" | "commonjs" {
  try {
    const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
      type?: string;
    };
    return parsed.type === "module" ? "module" : "commonjs";
  } catch {
    return "commonjs";
  }
}

function isTypeScriptSource(file: string): boolean {
  return SOURCE_EXTENSIONS.some((extension) => file.endsWith(extension));
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

function hasConcreteExtension(specifier: string): boolean {
  return PROBE_EXTENSIONS.some((extension) => specifier.endsWith(extension));
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}
