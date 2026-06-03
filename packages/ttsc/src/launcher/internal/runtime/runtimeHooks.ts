import path from "node:path";
import fs from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { looseTsconfigFor } from "./looseConfig";
import { detectModuleFormat } from "./moduleSyntax";
import {
  resolvePackageImportsTarget,
  resolvePackageTypeScriptTarget,
  typeScriptForTarget,
} from "./packageTarget";
import {
  findOwningPackageRoot,
  isFile,
  isJavaScriptOutput,
  isTypeScriptSource,
  javaScriptForTarget,
  realPath,
  typeScriptCounterpart,
} from "./paths";
import { emitSync } from "./syncEmit";

/**
 * Synchronous module hooks that make `ttsx` the ts-node it should be: every
 * TypeScript source — entry, workspace neighbour, or raw `.ts` dependency under
 * `node_modules` — is emitted on demand through its owning project's program
 * (full transform, not type-stripping), and Node loads the result.
 * `registerHooks` covers both the ESM `import` graph and CommonJS `require`.
 *
 * - `resolve` recovers a target Node could not find — a published `.js` entry
 *   whose `.ts` source ships instead, an extensionless relative import, a bare
 *   package whose default entry is raw `.ts` — and prefers a `.ts` source over a
 *   co-located stale `.js`. Query/hash suffixes are preserved so module identity
 *   is unchanged.
 * - `load` emits each `.ts` through the host under its owning tsconfig (or a
 *   synthesized loose tsconfig when no project emits it) and returns the
 *   JavaScript with the Node format the file resolves to.
 */

interface ResolveContext {
  parentURL?: string;
  conditions?: readonly string[];
  importAttributes?: Record<string, string>;
}
interface ResolveResult {
  url: string;
  format?: string | null;
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

/** The entry's tsconfig and project root, used to scope loose compilation. */
let fallbackTsconfig = "";
let entryRoot = "";

/** Install the hooks. `entryTsconfig` owns files with no nearer tsconfig. */
export function installHooks(entryTsconfig: string): void {
  fallbackTsconfig = entryTsconfig;
  entryRoot = path.dirname(entryTsconfig);
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
  let result: ResolveResult;
  try {
    result = nextResolve(specifier, context);
  } catch (error) {
    const recovered = recoverMissing(specifier, context, error);
    if (recovered !== null) {
      return served(recovered, urlSuffix(specifier));
    }
    throw error;
  }
  // Prefer a TypeScript source over a co-located JavaScript file: a `.ts` source
  // that imports `./x.js` means `x.ts`, even when a stale `x.js` sits beside it.
  if (typeof result.url === "string" && result.url.startsWith("file:")) {
    const [base, suffix] = splitUrlSuffix(result.url);
    const filePath = fileURLToPath(base);
    if (isJavaScriptOutput(filePath)) {
      const counterpart = typeScriptCounterpart(filePath);
      if (counterpart !== null) {
        return served(counterpart, suffix);
      }
    }
  }
  return result;
}

/** A resolve result that loads `file` (plus any preserved query/hash suffix). */
function served(file: string, suffix: string): ResolveResult {
  return { shortCircuit: true, url: pathToFileURL(file).href + suffix };
}

/**
 * Recover a module target Node failed to resolve. A `file:` error URL (a
 * resolved-but-missing `.js` entry target, an extensionless relative import) is
 * mapped to the `.ts` source or `.js` file that actually backs it; a bare or
 * `#` specifier with no error URL is resolved through its package's
 * `exports`/`imports` map to the raw `.ts` it ships.
 */
function recoverMissing(
  specifier: string,
  context: ResolveContext,
  error: unknown,
): string | null {
  const errorUrl = (error as { url?: unknown } | null)?.url;
  if (typeof errorUrl === "string" && errorUrl.startsWith("file:")) {
    return backingFile(fileURLToPath(splitUrlSuffix(errorUrl)[0]));
  }
  const parentDir = context.parentURL?.startsWith("file:")
    ? path.dirname(fileURLToPath(context.parentURL))
    : entryRoot;
  // A relative specifier with no error URL (CommonJS `require("./x")`): probe
  // the importer's directory for the `.ts` source or `.js` file it names.
  if (isRelativeSpecifier(specifier)) {
    return backingFile(path.resolve(parentDir, stripSuffix(specifier)));
  }
  if (!isModuleNotFound(error)) {
    return null;
  }
  const conditions = [...(context.conditions ?? ["import", "node"])];
  if (specifier.startsWith("#")) {
    return resolvePackageImportsTarget(specifier, parentDir, conditions);
  }
  return resolvePackageTypeScriptTarget(specifier, parentDir, conditions);
}

/**
 * The on-disk file a resolved target maps to: the raw `.ts` source a package
 * ships in place of a `.js`/extensionless target, otherwise an existing `.js`
 * file (an extensionless relative import inside compiled output). Null when
 * nothing backs the target so Node's original error stands.
 */
function backingFile(target: string): string | null {
  return typeScriptForTarget(target) ?? javaScriptForTarget(target);
}

function load(
  url: string,
  context: LoadContext,
  nextLoad: (u: string, c?: LoadContext) => LoadResult,
): LoadResult {
  if (!url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const [base, suffix] = splitUrlSuffix(url);
  const file = fileURLToPath(base);
  if (!isTypeScriptSource(file)) {
    return nextLoad(url, context);
  }
  const emitted = emitFile(file);
  // Rewrite relative specifiers to the resolved on-disk extension. Node's
  // ESM→CJS translator resolves a `require("./x")` against the classic CJS
  // resolver, which never finds `./x.ts`; spelling the extension makes the path
  // an exact match the `load` hook then emits. Bare specifiers keep going
  // through `resolve`.
  const source = rewriteRelativeSpecifiers(emitted, file);
  // The suffix is dropped from the executed source but preserved on the URL, so
  // a `./helper.js?query` import keeps its query in `import.meta.url`.
  void suffix;
  return { format: moduleFormat(file, source), shortCircuit: true, source };
}

/**
 * Emit one TypeScript source through the host. The file compiles under the
 * nearest real tsconfig that owns it; when no project emits it (a raw `.ts`
 * dependency, or an entry source outside the project's `include`), a synthesized
 * loose tsconfig is used instead.
 */
function emitFile(file: string): string {
  const owner = ownerTsconfig(file);
  if (owner === null) {
    return emitSync({ tsconfig: looseTsconfigFor(looseInputs(file)), file });
  }
  try {
    return emitSync({ tsconfig: owner, file });
  } catch (error) {
    if (!isUnemittable(error)) {
      throw error;
    }
    // The owning project parses the file but does not emit it (outside its
    // `include`, or a generated source): fall back to a loose single-file emit.
    return emitSync({ tsconfig: looseTsconfigFor(looseInputs(file)), file });
  }
}

function looseInputs(file: string): {
  file: string;
  entryTsconfig: string;
  entryRoot: string;
} {
  return { file, entryTsconfig: fallbackTsconfig, entryRoot };
}

/**
 * The nearest real `tsconfig.json` that owns `file`, searching up to but not
 * past the file's own package root, or null when the package ships no tsconfig
 * (a raw `.ts` dependency that must be compiled loosely). The entry project's
 * own tsconfig is found before its package root is reached.
 */
function ownerTsconfig(file: string): string | null {
  const packageRoot = findOwningPackageRoot(realPath(file));
  let dir = path.dirname(file);
  for (;;) {
    const candidate = path.join(dir, "tsconfig.json");
    if (isFile(candidate)) {
      return candidate;
    }
    if (packageRoot !== null && realPath(dir) === packageRoot) {
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

/**
 * Whether an emit error means the program parsed the file but produced no
 * JavaScript (outside `include`, or not in the program), which a loose
 * single-file emit can recover, as opposed to a real compile failure.
 */
function isUnemittable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("no JavaScript produced") ||
    message.includes("source file is not in program")
  );
}

/**
 * The Node module format a TypeScript source resolves to. `.mts` is ESM and
 * `.cts` is CommonJS by extension; a `.ts`/`.tsx` follows its nearest
 * package.json `type` when set, and otherwise its emitted JavaScript's syntax,
 * exactly as Node's own detection does. This matches the module kind tsgo
 * emitted, so the loaded JavaScript is interpreted correctly.
 */
function moduleFormat(file: string, emittedCode: string): "module" | "commonjs" {
  if (file.endsWith(".mts")) {
    return "module";
  }
  if (file.endsWith(".cts")) {
    return "commonjs";
  }
  const explicit = explicitPackageType(file);
  if (explicit !== null) {
    return explicit;
  }
  return detectModuleFormat(file, emittedCode);
}

/**
 * The `type` of the nearest package.json above `file`, or null when the nearest
 * manifest sets no `type` (Node then decides by syntax) or none exists. The
 * search stops at the nearest manifest: a parent `type` does not apply across a
 * nested package boundary.
 */
function explicitPackageType(file: string): "module" | "commonjs" | null {
  let dir = path.dirname(file);
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (isFile(manifest)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifest, "utf8")) as {
          type?: string;
        };
        if (parsed.type === "module") return "module";
        if (parsed.type === "commonjs") return "commonjs";
        return null;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

const PROBE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
] as const;

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
  return code.replace(
    pattern,
    (match, head: string, quote: string, spec: string) => {
      if (hasConcreteExtension(spec)) {
        return match;
      }
      const resolved = probeRelative(dir, spec);
      return resolved === null ? match : `${head}${quote}${resolved}${quote}`;
    },
  );
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

function hasConcreteExtension(specifier: string): boolean {
  return PROBE_EXTENSIONS.some((extension) => specifier.endsWith(extension));
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith(".\\") ||
    specifier.startsWith("..\\")
  );
}

function isModuleNotFound(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND";
}

/** The trailing `?query` / `#hash` of a specifier or URL, or `""`. */
function urlSuffix(value: string): string {
  const match = value.match(/[?#].*$/);
  return match ? match[0] : "";
}

function stripSuffix(value: string): string {
  const suffix = urlSuffix(value);
  return suffix === "" ? value : value.slice(0, -suffix.length);
}

/** Split a URL into its base and trailing `?query` / `#hash` suffix. */
function splitUrlSuffix(url: string): [string, string] {
  const suffix = urlSuffix(url);
  return suffix === "" ? [url, ""] : [url.slice(0, -suffix.length), suffix];
}
