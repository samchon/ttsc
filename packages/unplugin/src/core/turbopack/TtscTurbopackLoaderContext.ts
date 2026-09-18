import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

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
