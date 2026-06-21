import type { TtscUnpluginOptions } from "./core/options";
import { resolveOptions } from "./core/options";
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
  transformTtsc(
    file,
    source,
    resolveOptions(this.getOptions?.() ?? {}),
    undefined,
    transformCache,
  ).then(
    (result) => callback(undefined, result?.code ?? source),
    (error) => callback(error),
  );
}
