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
 * lifecycles use a per-build cache; a watching Vite development server keeps
 * persistent validation because its one `buildStart` spans later HMR edits,
 * while a dev server configured without a watcher takes the build-scoped path
 * with them, having declared it will observe no edit at all.
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
  let viteWatching = true;

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
        // `server.watch: null` disables Vite's watcher outright, which is how
        // a one-shot consumer (a `vitest --run` suite above all) configures the
        // dev server. Nothing can then deliver a change event, so every watch
        // registration is dead weight, and not cheap dead weight: Vite's
        // import analysis resolves each registered path like a real import of
        // the transformed module, once per module, which is the dominant cost
        // of a delivered module in a project with a real dependency graph
        // (samchon/ttsc#1246).
        viteWatching =
          (config as { server?: { watch?: unknown } }).server?.watch !== null;
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
      // Persistent validation exists for a session that spans edits it can
      // observe, and a dev server told to open no watcher is not one:
      // `server.watch: null` leaves Vite with no change channel at all, so no
      // edit can reach the session, nothing invalidates what one touched, and
      // no client is hot-updated. Validating each delivery there does not buy
      // freshness, it buys incoherence — modules delivered before an edit and
      // after it would come from two different compilations of one program —
      // while costing a full derived-input proof per delivered module. The
      // build-scoped lifecycle settles each module's first delivery against the
      // generation the session started from, exactly as a build does, and still
      // revalidates a module this session already delivered. A one-shot suite
      // configures precisely this server (`vitest --run` sets `server.watch =
      // null`) and is the workload behind samchon/ttsc#970
      // (samchon/ttsc#1260). The neighbouring watch-registration decision reads
      // the same two properties for the same reason.
      if (viteCommand === "serve" && viteWatching) {
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
        addWatchFile: (watched, evidence) => {
          if (viteCommand === "serve" && missingInputs.serving()) {
            // Trust the generation's recorded existence when it supplied one:
            // every cache hit revalidates it, and probing each input again
            // costs one `existsSync` per input per delivered module.
            const missing = evidence?.missing ?? !fs.existsSync(watched);
            if (missing) {
              missingInputs.watch(
                watched,
                path.resolve(file),
                evidence?.identity,
              );
              return;
            }
          }
          // A dev server configured without a watcher can never deliver a
          // change event, so a registration here buys nothing, and it is not
          // free: Vite's import analysis resolves every registered path like a
          // real import of the transformed module, once per module. The
          // adapter's own missing-input poll above stays active either way,
          // because it never depended on Vite's watcher.
          if (viteCommand === "serve" && !viteWatching) {
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
export type {
  TtscTransformFilesystemOperations,
  TtscTransformHooks,
  TtscWatchInputEvidence,
} from "./transform";
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
