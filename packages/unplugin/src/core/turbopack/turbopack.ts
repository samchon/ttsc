import type { HostWatchBridge } from "../bridge/HostWatchBridge";
import { hostToolDirectory } from "../bridge/hostToolDirectory";
import { openHostWatchBridge } from "../bridge/openHostWatchBridge";
import { refreshProjectRecordFiles } from "../bridge/refreshProjectRecordFiles";
import { registerProjectRecord } from "../bridge/registerProjectRecord";
import { isTransformTarget } from "../isTransformTarget";
import { resolveOptions } from "../options/resolveOptions";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { TtscCompileFailureError } from "../transform/errors/TtscCompileFailureError";
import { readTtscTransformSession } from "../transform/session/readTtscTransformSession";
import { shareTtscTransformCache } from "../transform/session/shareTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import { stripQuery } from "../transform/utils/stripQuery";
import type { TtscProjectRegistration } from "../transform/watch/TtscProjectRegistration";
import type { TtscTransformHooks } from "../transform/watch/TtscTransformHooks";
import type { TtscTurbopackLoaderContext } from "./TtscTurbopackLoaderContext";
import { failedModuleSource } from "./failedModuleSource";

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
const session = readTtscTransformSession();
shareTtscTransformCache(transformCache, session);

/**
 * The worker's watch bridge during `next dev`, opened by its first watching
 * delivery, when it takes every record of the tool directory, and alive for the
 * worker's lifetime.
 */
let bridge: HostWatchBridge | undefined;

/**
 * The tool directories whose records this worker has proven against the disk
 * for a one-shot build, for a loader wired by hand, without `withTtsc`.
 */
const refreshed = new Set<string>();

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
  // The project's record goes into Turbopack's `fileDependencies` set beside
  // the module, and nothing else does: the record moves when any input of the
  // generation does, so an edit to a type-only input the compile consulted
  // re-runs this loader. `addDependency` is bound so the webpack loader
  // context stays `this` inside it; the hook fires on cache hits too, which is
  // required because the shared transform cache lives for the worker lifetime
  // across requests. A module the plugin declared volatile is marked
  // uncacheable through the same loader contract.
  //
  // The record lives in the tool directory of the root Turbopack resolved
  // (`rootContext`), inside its project filesystem root, which Turbopack
  // rejects a dependency outside of (samchon/ttsc#1422) and whose watcher
  // hears the record move. Turbopack
  // takes a dependency's state as its baseline only when the loader returns,
  // so a change landing before then never re-runs the module
  // (samchon/ttsc#1423); the bridge observes every input from the compile on
  // and moves the record again until a registration proves a delivery read
  // the changed state.
  const addDependency = this.addDependency?.bind(this);
  const cacheable = this.cacheable?.bind(this);
  const emitError = this.emitError?.bind(this);
  const watching = process.env.NODE_ENV !== "production";
  const projectRoot = this.rootContext ?? process.cwd();
  const toolDirectory = hostToolDirectory(projectRoot);
  const loaderOptions = this.getOptions?.() ?? {};
  // Turbopack gives a loader no build start, so the records are proven at the
  // process's first delivery. A watching worker's bridge takes every record as
  // it opens, proving them as it does, and observes the projects the worker
  // restores from Turbopack's cache without a delivery from then on. A
  // one-shot worker proves the records of its own tool directory once, which
  // is the one `withTtsc` cannot prove for it: the wrapper knows only the
  // directory Next was started in, while a loader's records live below the
  // root Turbopack resolved, and a `turbopack.root` above the app, which is
  // how a monorepo is configured, makes those two different directories.
  let bridgeStartedAt: number | undefined;
  if (watching && addDependency !== undefined) {
    if (bridge === undefined) {
      bridge = openHostWatchBridge(projectRoot);
      refreshProjectRecordFiles(toolDirectory, bridge);
    }
    bridgeStartedAt = bridge.begin();
  } else if (!refreshed.has(toolDirectory)) {
    refreshed.add(toolDirectory);
    refreshProjectRecordFiles(toolDirectory);
  }
  const hooks: TtscTransformHooks = {
    ...(addDependency === undefined
      ? {}
      : {
          project: {
            register: (registration: TtscProjectRegistration) =>
              registerProjectRecord({
                addWatchFile: addDependency,
                ...(bridge !== undefined && bridgeStartedAt !== undefined
                  ? { bridge: { instance: bridge, startedAt: bridgeStartedAt } }
                  : {}),
                registration,
              }),
            toolDirectory,
          },
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
