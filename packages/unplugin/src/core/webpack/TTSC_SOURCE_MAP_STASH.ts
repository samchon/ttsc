import type { TtscTransformResult } from "../transform/TtscTransformResult";

/** The process-wide name the registry is kept under. */
const REGISTRY = Symbol.for("@ttsc/unplugin/source-map");

/**
 * Transform results left for {@link restoreTtscSourceMap}, keyed by the loader
 * context of the module they belong to (samchon/ttsc#1392).
 *
 * Unplugin's webpack and Rspack loaders hand a transform's map on only when the
 * module arrived with one, and the ttsc loader runs first, so its map never
 * reached the next loader. The transform leaves its result here, under the
 * loader context webpack and Rspack share among the loaders of one module, and
 * the loader that runs next takes it back out. The loader context itself
 * accepts no new property, since the loader runner closes it to extension.
 *
 * One registry per process, reached through `Symbol.for`, because the host
 * loads that loader as a module instance of its own, apart from the one the
 * plugin runs in.
 */
export const TTSC_SOURCE_MAP_STASH: WeakMap<object, TtscTransformResult> = ((
  globalThis as { [REGISTRY]?: WeakMap<object, TtscTransformResult> }
)[REGISTRY] ??= new WeakMap());
