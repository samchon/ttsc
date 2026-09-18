import { isTransformTarget } from "../isTransformTarget";
import { resolveOptions } from "../options/resolveOptions";
import { createTtscTransformCache } from "../transform/cache/createTtscTransformCache";
import { transformTtsc } from "../transform/transformTtsc";
import { stripQuery } from "../transform/utils/stripQuery";
import type { TtscTransformHooks } from "../transform/watch/TtscTransformHooks";
import type { TtscTurbopackLoaderContext } from "./TtscTurbopackLoaderContext";

/**
 * Per-process transform cache. Turbopack runs loaders in a worker pool and
 * never signals build boundaries to a loader, so the cache lives for the
 * worker's lifetime. Because no build-start boundary exists, every cache hit
 * validates all project and graph inputs before selecting output (see
 * `transformTtsc`).
 */
const transformCache = createTtscTransformCache();

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
 * Pass {@link TtscUnpluginOptions} through the rule's `options` object. The
 * loader returns the source unchanged for anything {@link isTransformTarget}
 * excludes: declaration files, `node_modules` paths, non-TypeScript sources,
 * and virtual ids. It also preserves transforms that produce no change and
 * applies the shared predicate itself rather than a local copy, because a broad
 * rule glob routes everything matching the extension through the loader.
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
  const addDependency = this.addDependency?.bind(this);
  const cacheable = this.cacheable?.bind(this);
  const hooks: TtscTransformHooks = {
    ...(addDependency === undefined ? {} : { addWatchFile: addDependency }),
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
    (result) => callback(undefined, result?.code ?? source),
    (error) => callback(error),
  );
}
