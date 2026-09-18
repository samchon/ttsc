import { BRIDGED_WATCH_INPUT_KINDS } from "../bridge/BRIDGED_WATCH_INPUT_KINDS";
import type { HostWatchBridge } from "../bridge/HostWatchBridge";
import { openHostWatchBridge } from "../bridge/openHostWatchBridge";
import { registerBuildWatchInputs } from "../bridge/registerBuildWatchInputs";
import { isTransformTarget } from "../isTransformTarget";
import { resolveOptions } from "../options/resolveOptions";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { readTtscTransformSession } from "../transform/session/readTtscTransformSession";
import { shareTtscTransformCache } from "../transform/session/shareTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import { stripQuery } from "../transform/utils/stripQuery";
import type { TtscTransformHooks } from "../transform/watch/TtscTransformHooks";
import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { TtscTurbopackLoaderContext } from "./TtscTurbopackLoaderContext";

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
  const watching = process.env.NODE_ENV !== "production";
  const bridgeStartedAt =
    watching && addDependency !== undefined
      ? (bridge ??= openHostWatchBridge(
          this.rootContext ?? process.cwd(),
        )).begin()
      : undefined;
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
              loader: {
                addContextDependency: addContextDependency ?? addDependency,
                addDependency,
                addMissingDependency: addDependency,
              },
            }),
        }),
    ...(cacheable === undefined
      ? {}
      : { markVolatile: () => cacheable(false) }),
  };
  transformTtsc(
    file,
    source,
    resolveOptions(this.getOptions?.() ?? {}),
    undefined,
    transformCache,
    Object.keys(hooks).length === 0 ? undefined : hooks,
  ).then(
    (result) =>
      result === undefined
        ? callback(undefined, source)
        : callback(undefined, result.code, result.map),
    (error) => callback(error),
  );
}
