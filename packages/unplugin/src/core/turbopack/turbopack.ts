import path from "node:path";

import { BRIDGED_WATCH_INPUT_KINDS } from "../bridge/BRIDGED_WATCH_INPUT_KINDS";
import type { HostWatchBridge } from "../bridge/HostWatchBridge";
import { hostToolDirectory } from "../bridge/hostToolDirectory";
import { openHostWatchBridge } from "../bridge/openHostWatchBridge";
import { registerBuildWatchInputs } from "../bridge/registerBuildWatchInputs";
import { isTransformTarget } from "../isTransformTarget";
import { resolveOptions } from "../options/resolveOptions";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { TtscCompileFailureError } from "../transform/errors/TtscCompileFailureError";
import { pathIsWithin } from "../transform/filesystem/pathIsWithin";
import { readTtscTransformSession } from "../transform/session/readTtscTransformSession";
import { shareTtscTransformCache } from "../transform/session/shareTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import { stripQuery } from "../transform/utils/stripQuery";
import type { TtscTransformHooks } from "../transform/watch/TtscTransformHooks";
import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { TtscTurbopackLoaderContext } from "./TtscTurbopackLoaderContext";
import { failedModuleSource } from "./failedModuleSource";
import { resolveTurbopackRoot } from "./resolveTurbopackRoot";
import { turbopackProcessMarker } from "./turbopackProcessMarker";
import { warnUntrackedTurbopackInputs } from "./warnUntrackedTurbopackInputs";

/**
 * Per-process transform cache. Turbopack runs loaders in a worker pool and
 * never signals build boundaries to a loader, so the cache lives for the
 * worker's lifetime. Because no build-start boundary exists, every cache hit
 * validates all project and graph inputs before selecting output (see
 * `transformTtsc`). When `withTtsc` opened a session for the pool, the workers
 * share each compile through it instead of compiling the project once each
 * (samchon/ttsc#1390).
 */
const transformCache = createTtscTransformCache();
shareTtscTransformCache(transformCache, readTtscTransformSession());

/**
 * The worker's watch bridge for directory listings during `next dev`, opened by
 * its first watching delivery and alive for the worker's lifetime.
 */
let bridge: HostWatchBridge | undefined;

/**
 * Standalone webpack-loader entrypoint for Turbopack.
 *
 * Turbopack cannot load unplugin-based plugins (no JS plugin API), but its
 * `turbopack.rules` accept webpack loaders, and a ttsc transform is exactly
 * loader-shaped: pure TypeScript source in, transformed source out. Wire it per
 * extension:
 *
 * ```js
 * // next.config.mjs
 * const nextConfig = {
 *   turbopack: {
 *     rules: {
 *       "*.ts": { loaders: ["@ttsc/unplugin/turbopack"] },
 *       "*.tsx": { loaders: ["@ttsc/unplugin/turbopack"] },
 *       "*.mts": { loaders: ["@ttsc/unplugin/turbopack"] },
 *       "*.cts": { loaders: ["@ttsc/unplugin/turbopack"] },
 *     },
 *   },
 * };
 * ```
 *
 * Pass `TtscUnpluginOptions` through the rule's `options` object. The loader
 * returns the source unchanged for anything {@link isTransformTarget} excludes:
 * declaration files, `node_modules` paths, non-TypeScript sources, and virtual
 * ids. It also preserves transforms that produce no change and applies the
 * shared predicate itself rather than a local copy, because a broad rule glob
 * routes everything matching the extension through the loader.
 */
export function turbopack(
  this: TtscTurbopackLoaderContext,
  source: string,
): void {
  const callback = this.async();
  const file = stripQuery(this.resourcePath);
  // The shared predicate itself, not a copy of part of it. A rule wider than
  // the four exact TypeScript source rules is natural for a mixed project, but
  // it used to route JavaScript and virtual ids into the whole-project
  // transform that every other adapter excludes. The program has no entry for
  // them, so delivery fails (samchon/ttsc#1305).
  if (!isTransformTarget(file)) {
    callback(undefined, source);
    return;
  }
  // Forward the derived watch inputs (plugin-reported dependencies plus the
  // host-owned reference graph) into Turbopack's `fileDependencies` set so
  // editing a type-only input a transform consulted re-runs this loader.
  // `addDependency` is bound so the webpack loader context stays `this` inside
  // it; the hook fires on cache hits too, which is required because the shared
  // transform cache lives for the worker lifetime across requests. A module
  // the plugin declared volatile is marked uncacheable through the same loader
  // contract.
  //
  // Each input goes to the channel measured to observe its predicate
  // (samchon/ttsc#1388). `addDependency` observes a file's edit and a missing
  // path's creation, where `addMissingDependency` does not observe the
  // creation. A directory the compiler only checked exists is not registered,
  // since each of its probed descendants is. A listing needs a directory
  // channel, and Turbopack's `addContextDependency` is recursive: on the
  // project root, which the compiler lists, every write into `.next`
  // re-invalidated the module, and `next dev` re-ran the loader hundreds of
  // times per change. A development session therefore observes listings
  // through the worker's bridge, and only a one-shot build, whose persistent
  // cache still needs them, takes the context channel.
  const addDependency = this.addDependency?.bind(this);
  const addContextDependency = this.addContextDependency?.bind(this);
  const cacheable = this.cacheable?.bind(this);
  const emitError = this.emitError?.bind(this);
  const watching = process.env.NODE_ENV !== "production";
  // Turbopack rejects a dependency outside its project filesystem root, which
  // failed every module with "leaves the filesystem root" while the bridge's
  // sentinels lived in the system temp directory. They live in the project's
  // own tool directory instead, where Turbopack's watcher hears them.
  const projectRoot = this.rootContext ?? process.cwd();
  const toolDirectory = hostToolDirectory(projectRoot);
  const loaderOptions = this.getOptions?.() ?? {};
  // Turbopack fails the whole module on a dependency outside its project
  // filesystem root, so only the inputs inside it reach Turbopack
  // (samchon/ttsc#1422).
  const turbopackRoot = resolveTurbopackRoot(
    projectRoot,
    loaderOptions.turbopackRoots,
  );
  // Turbopack takes a dependency's state as its baseline only when the loader
  // returns, so a change landing before then never re-runs the module
  // (samchon/ttsc#1423). The bridge observes every input as well, from the
  // compile on, and rewrites a stale module's sentinel until a registration
  // proves the module delivered the changed state.
  let bridgeStartedAt: number | undefined;
  if (watching && addDependency !== undefined) {
    bridge ??= openHostWatchBridge(projectRoot, {}, toolDirectory, true);
    bridgeStartedAt = bridge.begin();
  }
  const hooks: TtscTransformHooks = {
    ...(addDependency === undefined
      ? {}
      : {
          addWatchFiles: (
            inputs: readonly TtscWatchInput[],
            failed?: boolean,
          ) =>
            registerBuildWatchInputs({
              addWatchFile: addDependency,
              ...(bridge !== undefined && bridgeStartedAt !== undefined
                ? {
                    bridge: {
                      // Every input, since Turbopack's own channel misses a
                      // change made before its baseline.
                      ignores: () => true,
                      instance: bridge,
                      kinds:
                        BRIDGED_WATCH_INPUT_KINDS.recursiveDirectoryChannel,
                      startedAt: bridgeStartedAt,
                    },
                  }
                : {}),
              failed,
              file,
              inputs,
              projectRoot,
              loader: {
                accepts: (input) =>
                  pathIsWithin(path.resolve(input), turbopackRoot),
                addContextDependency: addContextDependency ?? addDependency,
                addDependency,
                addMissingDependency: addDependency,
              },
              // A result Turbopack persists cannot be proven without the inputs
              // it could not track, so a later process re-runs the module.
              untracked: () => {
                addDependency(turbopackProcessMarker(toolDirectory));
                warnUntrackedTurbopackInputs(
                  projectRoot,
                  loaderOptions.turbopackRoots,
                );
              },
            }),
          // A development session's bridge observes the root files
          // (samchon/ttsc#1419); a build, and a session restored from
          // Turbopack's cache, hear them through the membership record
          // (samchon/ttsc#1468).
          membership: true,
          toolDirectory,
        }),
    ...(cacheable === undefined
      ? {}
      : { markVolatile: () => cacheable(false) }),
  };
  transformTtsc(
    file,
    source,
    resolveOptions(loaderOptions),
    undefined,
    transformCache,
    Object.keys(hooks).length === 0 ? undefined : hooks,
  ).then(
    (result) =>
      result === undefined
        ? callback(undefined, source)
        : callback(undefined, result.code, result.map),
    (error) => {
      // Turbopack discards a worker whose loader run failed and starts a fresh
      // one for the next, so in a development session a compile that failed
      // once cost every module of the project its own cold worker, and the
      // page's error outlasted the dev server's patience on a slow machine
      // (samchon/ttsc#1458). The compiler's verdict on the project's state, a
      // compile that ended in diagnostics or in an exception it reported, is
      // reported through the loader context's own channel instead, and the
      // module evaluates to that error, so the worker lives on and the page
      // fails with the same message until an input changes, which is what
      // the verdict is a function of. Every other failure, an adapter error
      // before any compile or a generation the adapter could not capture
      // while its inputs kept changing, says nothing about the state, and a
      // module kept on it would never run again: the run fails, and Turbopack
      // runs the module again on its next request. A one-shot build, which
      // runs each module once, fails the run outright.
      if (
        !watching ||
        emitError === undefined ||
        !(error instanceof TtscCompileFailureError)
      ) {
        callback(error);
        return;
      }
      emitError(error);
      callback(undefined, failedModuleSource(error));
    },
  );
}
