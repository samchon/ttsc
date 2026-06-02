import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  type Resolution,
  classifyExisting,
  classifyMissing,
  targetPath,
} from "./runtime/classify";
import {
  resolvePackageImportsTarget,
  resolvePackageTypeScriptTarget,
} from "./runtime/packageTarget";
import { isJavaScriptOutput, typeScriptCounterpart } from "./runtime/paths";
import { type RuntimeEnv, readRuntimeEnv } from "./runtime/runtimeEnv";
import { serveTypeScript } from "./runtime/serve";

/**
 * Node ESM module-customization hooks for the `ttsx` child process.
 *
 * `resolve` recovers a module target Node could not find — a published `.js`
 * entry target whose `.ts` source is what actually exists, an extensionless
 * relative import, a bare package whose default entry is unbuilt — to the
 * source it should load. `load` serves any TypeScript source's compiled bytes
 * (from the dependency cache or the entry compile gate) under that source's own
 * URL, so `import.meta.url` keeps source identity and transform plugins like
 * typia run.
 *
 * When the process was not launched by `ttsx` (no runtime env), both hooks fall
 * straight through to Node.
 */

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

export async function resolve(
  specifier: string,
  context: ResolveContext,
  nextResolve: NextResolve,
): Promise<ResolveResult> {
  const runtime = readRuntimeEnv();
  if (runtime === null) {
    return nextResolve(specifier, context);
  }
  let result: ResolveResult;
  try {
    result = await nextResolve(specifier, context);
  } catch (error) {
    const recovered = recoverMissing(specifier, context, error, runtime);
    if (recovered !== null) {
      return served(targetPath(recovered), urlSuffix(specifier));
    }
    throw error;
  }
  // Prefer a TypeScript source over a co-located JavaScript file: a TS source
  // that imports `./x.js` means `x.ts`, even when a stale `x.js` sits beside it.
  if (result.url.startsWith("file:")) {
    const [base, suffix] = splitUrlSuffix(result.url);
    const filePath = fileURLToPath(base);
    if (isJavaScriptOutput(filePath)) {
      const counterpart = typeScriptCounterpart(filePath);
      if (counterpart !== null && classifyExisting(counterpart, runtime)) {
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

/** The trailing `?query` / `#hash` of a specifier or URL, or `""`. */
function urlSuffix(value: string): string {
  const match = value.match(/[?#].*$/);
  return match ? match[0] : "";
}

/** Split a URL into its base and trailing `?query` / `#hash` suffix. */
function splitUrlSuffix(url: string): [string, string] {
  const suffix = urlSuffix(url);
  return suffix === "" ? [url, ""] : [url.slice(0, -suffix.length), suffix];
}

export async function load(
  url: string,
  context: LoadContext,
  nextLoad: NextLoad,
): Promise<LoadResult> {
  const runtime = readRuntimeEnv();
  if (runtime === null || !url.startsWith("file:")) {
    return nextLoad(url, context);
  }
  const served = serveTypeScript(fileURLToPath(url), runtime);
  if (served === null) {
    return nextLoad(url, context);
  }
  return { format: served.format, shortCircuit: true, source: served.code };
}

/**
 * Recover a module target Node failed to resolve. A `file:` error URL (a
 * resolved-but-missing `.js` entry target, an extensionless relative import) is
 * classified directly; a bare specifier with no error URL (a package whose
 * default `index.js` is unpublished) is resolved through its `exports`/`main`/
 * index map under the `import` condition.
 */
function recoverMissing(
  specifier: string,
  context: ResolveContext,
  error: unknown,
  runtime: RuntimeEnv,
): Resolution | null {
  const errorUrl = (error as { url?: unknown } | null)?.url;
  if (typeof errorUrl === "string" && errorUrl.startsWith("file:")) {
    return classifyMissing(fileURLToPath(splitUrlSuffix(errorUrl)[0]), runtime);
  }
  if (!isModuleNotFound(error) || specifier.startsWith(".")) {
    return null;
  }
  const parentDir = context.parentURL?.startsWith("file:")
    ? path.dirname(fileURLToPath(context.parentURL))
    : runtime.entryRoot;
  const tsTarget = specifier.startsWith("#")
    ? resolvePackageImportsTarget(specifier, parentDir, ["import", "node"])
    : resolvePackageTypeScriptTarget(specifier, parentDir, ["import", "node"]);
  return tsTarget === null ? null : classifyExisting(tsTarget, runtime);
}

function isModuleNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "ERR_MODULE_NOT_FOUND";
}
