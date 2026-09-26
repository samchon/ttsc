import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * The plugin-reported dependency paths the last generation of each cache key
 * named (`TtscCachedProjectTransform.externalDependencyInputs`), which the
 * key's next compile witnesses before it starts (samchon/ttsc#1541).
 *
 * A compile learns such a path only from its own envelope, and a path it has no
 * witness for is compiled again. The generation that named the paths may be
 * gone by the next compile: a host ending its build resets the cache, as
 * esbuild and Bun do after every rebuild, and a failed generation is evicted.
 * The paths therefore outlive the generation here, so a project whose plugin
 * keeps reporting the same file compiles once per change rather than twice.
 * They only say what to read; the capture certifies what it reads.
 */
export const TRANSFORM_CACHE_DEPENDENCY_WITNESSES = new WeakMap<
  TtscTransformCache,
  Map<string, readonly string[]>
>();
