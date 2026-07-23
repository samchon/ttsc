import fs from "node:fs";
import path from "node:path";
import type { UnpluginFactory, UnpluginInstance } from "unplugin";
import { createUnplugin } from "unplugin";

import type { TtscUnpluginOptions } from "./options";
import { resolveOptions } from "./options";
import {
  beginTtscTransformBuild,
  collectExternalInputHashes,
  collectProjectInputHashes,
  createTtscTransformCache,
  isDeclarationFile,
  isProjectWalkPath,
  resetTtscTransformCache,
  stripQuery,
  transformTtsc,
} from "./transform";
import { createViteServeMissingInputWatch } from "./viteServe";

const name = "ttsc-unplugin";
/**
 * Matches any TypeScript or JavaScript source extension (.ts, .tsx, .mts, .cts,
 * etc.). Shared with the Bun adapter (`bun.ts`) so the filter is defined once
 * and both adapters stay in sync.
 */
export const sourceFilePattern = /\.[cm]?tsx?$/;
/** Matches any path segment that is a `node_modules` directory (cross-platform). */
const nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;
/**
 * Matches virtual module ids: Rollup/Vite use a leading NUL byte (`\0`) as
 * convention.
 */
const virtualModulePattern = /\0/;

/**
 * Unplugin factory that wires the ttsc transform pipeline into any supported
 * bundler (Vite, Rollup, Rolldown, webpack, Rspack, esbuild, Farm).
 *
 * The factory resolves raw options once, creates a per-build transform cache,
 * and captures Vite alias configuration via the `vite.configResolved` hook so
 * that path aliases are forwarded to the generated tsconfig overlay. Real build
 * lifecycles use a per-build cache; Vite's development server keeps persistent
 * validation because its one `buildStart` spans later HMR edits.
 */
const unpluginFactory: UnpluginFactory<
  TtscUnpluginOptions | undefined,
  false
> = (rawOptions = {}) => {
  const options = resolveOptions(rawOptions);
  const transformCache = createTtscTransformCache();
  const missingInputs = createViteServeMissingInputWatch();
  let aliases: unknown;
  let viteCommand: string | undefined;

  return {
    name,
    enforce: "pre",

    vite: {
      configResolved(config) {
        aliases = config.resolve.alias;
        // Re-read per config resolution: a plugin instance reused across a
        // serve and a later build must stop routing missing inputs to the
        // serve-time poll, even though the closed server stays attached
        // (see the dispose note in viteServe.ts).
        viteCommand = config.command;
      },
      // Vite serve funnels every transform-context `addWatchFile()` into the
      // module's added-import graph (`_addedImports`), which import-analysis
      // resolves like real imports. Capture the dev server so the transform
      // hook can route watch inputs that do not exist yet — superseding
      // resolution candidates above all — around that graph and still
      // invalidate their importers when the path is created.
      configureServer(server) {
        missingInputs.attach(server);
      },
      // Vite calls buildEnd when the dev server (or build) closes; drop every
      // poller so a stopped server leaks no watch state.
      buildEnd() {
        missingInputs.dispose();
      },
    },

    buildStart() {
      if (viteCommand === "serve") {
        resetTtscTransformCache(transformCache);
      } else {
        beginTtscTransformBuild(transformCache);
      }
    },

    transformInclude(id) {
      const file = stripQuery(id);
      return isTransformTarget(file);
    },

    async transform(source, id) {
      const file = stripQuery(id);
      if (!isTransformTarget(file)) {
        return undefined;
      }
      return transformTtsc(file, source, options, aliases, transformCache, {
        // Register the derived watch inputs (plugin-reported `dependencies`
        // unioned with the host-owned reference graph) so type-only inputs
        // invalidate this module in watch mode and persistent caches;
        // bundlers erase type-only imports from their own module graph and
        // would otherwise serve stale generated code. Under Vite serve a
        // missing input must not enter `addWatchFile`: import-analysis
        // resolves added imports and 500s on a path that is absent by design
        // (a superseding resolution candidate, a not-yet-generated
        // dependency), so those are watched on the filesystem instead and
        // invalidate this module when created.
        addWatchFile: (watched) => {
          if (
            viteCommand === "serve" &&
            missingInputs.serving() &&
            !fs.existsSync(watched)
          ) {
            missingInputs.watch(watched, path.resolve(file));
            return;
          }
          this.addWatchFile(watched);
        },
        // A module the plugin declared volatile depends on non-file inputs,
        // which no file-dependency snapshot can represent; mark it
        // uncacheable where the bundler exposes that control.
        markVolatile: () => {
          const native = this.getNativeBuildContext?.();
          if (
            native?.framework === "webpack" ||
            native?.framework === "rspack"
          ) {
            native.loaderContext?.cacheable?.(false);
          }
        },
      });
    },
  };
};

const unplugin: UnpluginInstance<TtscUnpluginOptions | undefined, false> =
  createUnplugin(unpluginFactory);

export type {
  TtscUnpluginCompilerOptionsJson,
  TtscUnpluginOptions,
} from "./options";
export type { TtscTransformHooks } from "./transform";
export {
  beginTtscTransformBuild,
  collectExternalInputHashes,
  collectProjectInputHashes,
  createTtscTransformCache,
  isProjectWalkPath,
  resetTtscTransformCache,
  resolveOptions,
  transformTtsc,
  unplugin,
};

export default unplugin;

/**
 * Returns `true` when the module id refers to a real TypeScript/JavaScript
 * source file that should be processed by the ttsc transform.
 *
 * Excluded ids: virtual modules (NUL prefix), `.d.ts` declaration files, and
 * anything inside `node_modules`.
 */
export function isTransformTarget(id: string): boolean {
  return (
    sourceFilePattern.test(id) &&
    !virtualModulePattern.test(id) &&
    !isDeclarationFile(id) &&
    !nodeModulesPattern.test(id)
  );
}
