import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * The options a Turbopack rule hands the loader: the adapter's own options,
 * passed through the rule's `options` object by `withTtsc` or by a rule wired
 * by hand.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The alias preserves the exact adapter-option domain passed through the
 *   Turbopack rule rather than inventing another compiler override scheme.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A named boundary reuses the common options type without duplicating its fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Options travel through the supported loader rule's options object.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the producer and rule boundary, with separated tags
 *   following the documentation skill.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscTurbopackLoaderOptions only declares a shape; it has no filesystem,
 *   path or process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscTurbopackLoaderOptions only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscTurbopackLoaderOptions only declares a shape; it has no work to reuse
 *   at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscTurbopackLoaderOptions only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export type TtscTurbopackLoaderOptions = TtscUnpluginOptions;
