import Module from "node:module";
import path from "node:path";

import { classifyExisting, classifyMissing, targetPath } from "./classify";
import { resolvePackageTypeScriptTarget } from "./packageTarget";
import {
  TYPESCRIPT_EXTENSIONS,
  isJavaScriptOutput,
  typeScriptCounterpart,
} from "./paths";
import { type RuntimeEnv, readRuntimeEnv } from "./runtimeEnv";
import { serveTypeScript } from "./serve";

type ResolveFilename = (
  request: string,
  parent: NodeModule | undefined,
  isMain: boolean,
  options?: unknown,
) => string;

type ExtensionHandler = (module: NodeModule, filename: string) => void;

interface MutableModule {
  _resolveFilename: ResolveFilename;
  _extensions: Record<string, ExtensionHandler>;
}

interface CompilableModule {
  _compile(code: string, filename: string): unknown;
}

let installed = false;

/**
 * Patch the CommonJS loader so `require()` reaches the same TypeScript the ESM
 * hooks serve: every TypeScript source loads its compiled bytes (from the
 * dependency cache or the entry gate) under its own filename, and a published
 * `.js` entry target or a spawned child's missing `.js` main maps to its `.ts`
 * source. A non-ttsx process leaves the loader untouched.
 */
export function installCjsHooks(): void {
  if (installed) {
    return;
  }
  const runtime = readRuntimeEnv();
  if (runtime === null) {
    return;
  }
  installed = true;
  const loader = Module as unknown as MutableModule;
  registerExtensions(loader, runtime);
  patchResolveFilename(loader, runtime);
}

/** Compile a TypeScript source by serving its compiled bytes under its path. */
function registerExtensions(loader: MutableModule, runtime: RuntimeEnv): void {
  const handler: ExtensionHandler = (module, filename) => {
    const served = serveTypeScript(filename, runtime);
    if (served === null) {
      throw new Error(`ttsx: could not compile ${filename}`);
    }
    (module as unknown as CompilableModule)._compile(served.code, filename);
  };
  for (const extension of TYPESCRIPT_EXTENSIONS) {
    loader._extensions[extension] = handler;
  }
}

function patchResolveFilename(
  loader: MutableModule,
  runtime: RuntimeEnv,
): void {
  const original = loader._resolveFilename.bind(loader);
  loader._resolveFilename = function (request, parent, isMain, options) {
    try {
      // A resolved `.ts` keeps its path; the registered extension serves its
      // compiled bytes. A resolved `.js` whose TypeScript counterpart exists is
      // remapped to it (the source meant `x.ts`, not a stale `x.js`); any other
      // `.js` loads normally.
      const resolved = original(request, parent, isMain, options);
      if (isJavaScriptOutput(resolved)) {
        const counterpart = typeScriptCounterpart(resolved);
        if (counterpart !== null && classifyExisting(counterpart, runtime)) {
          return counterpart;
        }
      }
      return resolved;
    } catch (error) {
      if (!isModuleNotFound(error)) {
        throw error;
      }
      const recovered = recover(request, parent, runtime);
      if (recovered !== null) {
        return recovered;
      }
      throw error;
    }
  };
}

/**
 * Recover a `require()` Node could not resolve. A relative/absolute target is
 * matched against its TypeScript counterpart; a bare specifier is resolved
 * through its package `exports`/`main`/index map under the `require`
 * condition.
 */
function recover(
  request: string,
  parent: NodeModule | undefined,
  runtime: RuntimeEnv,
): string | null {
  const parentDir = parent?.filename
    ? path.dirname(parent.filename)
    : runtime.entryRoot;
  if (request.startsWith(".") || path.isAbsolute(request)) {
    const target = path.isAbsolute(request)
      ? request
      : path.resolve(parentDir, request);
    const classified = classifyMissing(target, runtime);
    return classified === null ? null : targetPath(classified);
  }
  const tsTarget = resolvePackageTypeScriptTarget(request, parentDir, [
    "require",
    "node",
  ]);
  if (tsTarget === null) {
    return null;
  }
  const classified = classifyExisting(tsTarget, runtime);
  return classified === null ? null : targetPath(classified);
}

function isModuleNotFound(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "MODULE_NOT_FOUND";
}
