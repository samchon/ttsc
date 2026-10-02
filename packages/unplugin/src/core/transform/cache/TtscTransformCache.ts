import type { TtscCachedProjectTransform } from "./TtscCachedProjectTransform";

/**
 * Keyed by a stable JSON string that encodes the tsconfig path, compiler
 * options overlay, plugin list, and alias paths. The value is a `Promise` so
 * concurrent transforms for the same project share a single in-flight
 * compilation rather than spawning multiple `TtscCompiler` instances.
 *
 * @evidence contracts/common.md#principled-implementation A configuration key maps to the in-flight project promise, letting concurrent deliveries share the same compile and its recorded proof state.
 * @evidence contracts/common.md#clear-and-simple-design The alias uses standard Map and Promise operations rather than an additional cache abstraction with independent state.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A stored promise does not certify freshness; selection and validation owners must prove its generation before replay.
 * @evidence contracts/common.md#meaningful-documentation The prose names the key dimensions and explains why promise-valued entries are necessary for concurrent deliveries.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscTransformCache only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscTransformCache only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscTransformCache only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscTransformCache only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export type TtscTransformCache = Map<
  string,
  Promise<TtscCachedProjectTransform>
>;
