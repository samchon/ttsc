import type { TtscUnpluginOptions } from "./core/options";
import { resolveOptions } from "./core/options";
import type { TtscTransformHooks } from "./core/transform";
import {
  createTtscTransformCache,
  isDeclarationFile,
  stripQuery,
  transformTtsc,
} from "./core/transform";

/**
 * Subset of the webpack loader context Turbopack provides to loaders wired
 * through `turbopack.rules`. Turbopack has no JS plugin API, but it runs
 * webpack-compatible loaders: source string in, source string out, with
 * `async()` for asynchronous completion and `getOptions()` for the rule's
 * `options` object.
 */
export interface TtscTurbopackLoaderContext {
  /** Marks the loader asynchronous and returns the completion callback. */
  async(): (error?: unknown, content?: string) => void;
  /** Absolute path of the module being loaded. */
  resourcePath: string;
  /** The rule's `options` object, when one was configured. */
  getOptions?(): TtscUnpluginOptions | undefined;
  /**
   * Register an additional file the transformed module depends on. Part of the
   * webpack loader context contract Turbopack implements; a registered file
   * enters Turbopack's `fileDependencies` set so editing it re-runs this loader
   * for the owning module. Optional so a minimal stub context (or a Turbopack
   * build that predates the method) still loads.
   */
  addDependency?(file: string): void;
  /**
   * Toggle result cacheability. Part of the webpack loader context contract;
   * called with `false` when the ttsc plugin declared the module volatile
   * (output depends on non-file inputs), so the bundler never replays a cached
   * result for it. Optional so a minimal stub context still loads.
   */
  cacheable?(flag: boolean): void;
}

/** Matches any path segment that is a `node_modules` directory (cross-platform). */
const nodeModulesPattern = /(?:^|[/\\])node_modules(?:[/\\]|$)/;

/**
 * Per-process transform cache. Turbopack runs loaders in a worker pool and
 * never signals build boundaries to a loader, so the cache lives for the
 * worker's lifetime; entries self-invalidate by re-hashing the project's input
 * files on every request (see `transformTtsc`), which is the same freshness
 * rule the bundler-plugin adapters rely on between watch rebuilds.
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
 *     },
 *   },
 * };
 * ```
 *
 * Pass {@link TtscUnpluginOptions} through the rule's `options` object. The
 * loader returns the source unchanged for declaration files, `node_modules`
 * paths, and transforms that produce no change, mirroring the unplugin
 * adapters' `transformInclude` filter, since a broad rule glob routes
 * everything matching the extension through the loader.
 */
export default function turbopack(
  this: TtscTurbopackLoaderContext,
  source: string,
): void {
  const callback = this.async();
  const file = stripQuery(this.resourcePath);
  if (isDeclarationFile(file) || nodeModulesPattern.test(file)) {
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
