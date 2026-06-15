import fs from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Source/JS extensions probed when a plugin entry's extensionless relative import fails. */
const RESOLVABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
] as const;

/**
 * JavaScript extension → the TypeScript source extensions it may have been
 * emitted from, for an `import "./x.js"` that only exists on disk as `./x.ts`.
 */
const JS_TO_TS_EXTENSIONS: ReadonlyMap<string, readonly string[]> = new Map([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
]);

interface ResolveContext {
  readonly parentURL?: string;
  readonly conditions?: string[];
  readonly importAttributes?: Record<string, string | undefined>;
}

interface ResolveResult {
  url: string;
  format?: string | null;
  shortCircuit?: boolean;
}

type NextResolve = (
  specifier: string,
  context: ResolveContext,
) => ResolveResult;

let installed = false;

/**
 * Install a resolve hook so a plugin descriptor entry can import sibling
 * modules from source.
 *
 * ttsc loads a plugin's JS descriptor (the `transform` entry) during plugin
 * bootstrap, on the launcher thread — before any runtime source-loading hooks
 * are live. A descriptor entry is usually a lone module, but a plugin may
 * legitimately ship inside a package whose entry `import`s other files (e.g. a
 * package root that re-exports its runtime alongside the descriptor). Node's
 * own resolver then rejects the first extensionless / `.ts`-only relative
 * specifier with `ERR_MODULE_NOT_FOUND` and kills the whole load even though
 * the descriptor itself is valid — punishing a plugin merely for having
 * imports.
 *
 * This hook rescues exactly those specifiers, and only after Node's resolver
 * has already thrown, so a successful resolution is never perturbed and a
 * genuinely missing module still surfaces its original error. Idempotent.
 */
export function installPluginEntryResolveHook(): void {
  if (installed) {
    return;
  }
  installed = true;
  registerHooks({
    resolve(
      specifier: string,
      context: ResolveContext,
      nextResolve: NextResolve,
    ): ResolveResult {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        const rescued = probeRescuableSpecifier(specifier, context.parentURL);
        if (rescued === null) {
          throw error;
        }
        return {
          shortCircuit: true,
          url: rescued,
          format: formatForUrl(rescued),
        };
      }
    },
  });
}

/**
 * Rescue an extensionless (or `.js`-for-`.ts`) relative specifier that Node's
 * resolver rejected, by probing candidate source/JS extensions and directory
 * indexes relative to the importing file. Returns a `file:` URL or `null`.
 */
function probeRescuableSpecifier(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (
    !isRelativeSpecifier(specifier) ||
    parentURL === undefined ||
    !parentURL.startsWith("file:")
  ) {
    return null;
  }
  const base = path.resolve(path.dirname(fileURLToPath(parentURL)), specifier);
  const jsExtension = path.extname(base).toLowerCase();
  const tsExtensions = JS_TO_TS_EXTENSIONS.get(jsExtension);
  if (tsExtensions !== undefined) {
    const stem = base.slice(0, base.length - jsExtension.length);
    for (const extension of tsExtensions) {
      const candidate = stem + extension;
      if (isFile(candidate)) {
        return pathToFileURL(candidate).href;
      }
    }
    return null;
  }
  if (jsExtension.length !== 0) {
    // Already carries a concrete extension Node could not find — not rescuable.
    return null;
  }
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
 * Classify the module format of a rescued source file. A source `.ts`/`.tsx`
 * is loaded as an ES module (its `import`/`export` syntax handled as ESM)
 * instead of deferring to the package `type`, so an ESM-authored entry inside a
 * type-less package still loads rather than failing to "parse as CommonJS".
 */
function formatForUrl(url: string): "module" | "commonjs" | undefined {
  if (url.endsWith(".cts") || url.endsWith(".cjs")) {
    return "commonjs";
  }
  if (
    url.endsWith(".mts") ||
    url.endsWith(".mjs") ||
    url.endsWith(".ts") ||
    url.endsWith(".tsx")
  ) {
    return "module";
  }
  return undefined;
}

function isRelativeSpecifier(specifier: string): boolean {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}
