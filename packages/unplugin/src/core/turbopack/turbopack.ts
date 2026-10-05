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
import type { TtscProjectRegistration } from "../transform/watch/TtscProjectRegistration";
import type { TtscTransformHooks } from "../transform/watch/TtscTransformHooks";
import { createTurbopackLoaderBindings } from "./createTurbopackLoaderBindings";
import type { TtscTurbopackLoaderContext } from "./TtscTurbopackLoaderContext";
import { failedModuleSource } from "./failedModuleSource";

/**
 * Per-process transform cache. Turbopack runs loaders in a worker pool and
 * never signals build boundaries to a loader, so the cache lives for the
 * worker's lifetime. Because no build-start boundary exists, every cache hit
 * validates current reuse premises before selecting output (see
 * `transformTtsc`). When `withTtsc` opened a session for the pool, the workers
 * can adopt equivalent proven publications rather than always compiling locally
 * (samchon/ttsc#1390).
 */
const transformCache = createTtscTransformCache();
shareTtscTransformCache(transformCache, readTtscTransformSession());

/**
 * The worker's watch bridge during `next dev`, opened by its first watching
 * delivery, when it takes every record of the tool directory, and alive for the
 * worker's lifetime.
 */
let bridge: HostWatchBridge | undefined;

/**
 * The tool directories whose record inventory this worker has attempted
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
 *
 * @evidence contracts/common.md#principled-implementation
 *   The shared inclusion predicate preserves non-program inputs. Async loader
 *   completion delivers changed code/map or original source; project records
 *   carry generation dependencies and only compile verdicts become failed modules
 *   in development, while infrastructure failures remain rejected loader runs.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The loader owns callback adaptation and host hooks; compilation, records,
 *   option normalization and verdict encoding remain their dedicated boundaries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Bound host methods use the supported loader context. Keeping a worker for a
 *   reported compile verdict addresses Turbopack's real discard behavior without
 *   suppressing errors that cannot justify a reusable generation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains loader wiring and input exclusions; nearby paragraphs
 *   explain process lifetime, root records and failure distinctions per documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   rootContext or native cwd anchors product-owned records within Turbopack's
 *   accepted filesystem root. The shared observer owns native case/path/watch
 *   capabilities; optional bound methods represent host loader capabilities.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Inclusion and shallow option/hook adaptation retain path/own-key text work.
 *   Shared transform validation pays current native identity, byte/list/graph
 *   proofs and compiler misses/map delivery; it is not one constant lookup.
 *   First inventory per tool root adds record parse/replay/IO, while watching
 *   registration adds qualified observer work and error modules serialize errors.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   A worker cache shares validated project generations across loader calls;
 *   inherited sessions share compiles across pool workers. Without a build-start
 *   boundary every hit qualifies current producer proofs before selecting output;
 *   native observer authority may avoid rereading proven unchanged populations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The worker owns its cache, bridge and refreshed-root set for its lifetime.
 *   Turbopack exposes no loader teardown hook, so native live resources rely on
 *   worker lifetime rather than this function's explicit join/close. Persistent
 *   session storage has its own pruning owner; no count/byte cap or descendant
 *   cleanup guarantee follows from the worker exit. Refreshed roots record an
 *   attempted inventory even when inaccessible, not a completed proof certificate.
 */
export function turbopack(
  this: TtscTurbopackLoaderContext,
  source: string,
): void {
  const callback = this.async();
  // The loader context's `resourcePath` is the file's own; its query is
  // `resourceQuery`, so a `?` or `#` here belongs to a directory or file name.
  const file = this.resourcePath;
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
  const bindings = createTurbopackLoaderBindings(this);
  const { addDependency, emitError } = bindings;
  const watching = process.env.NODE_ENV !== "production";
  const projectRoot = this.rootContext ?? process.cwd();
  const toolDirectory = hostToolDirectory(projectRoot);
  const loaderOptions = bindings.readOptions();
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
    exactPath: true,
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
            // Turbopack takes no record outside its root, so a watching worker
            // refuses a module it could hand none (samchon/ttsc#1480).
            watching: bridge !== undefined,
          },
        }),
    ...(bindings.markVolatile === undefined
      ? {}
      : { markVolatile: bindings.markVolatile }),
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
      // retains the reported message under the adapter's generation validation.
      // A reported exception need not be deterministic for identical inputs.
      // Every other failure, an adapter error
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
