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
 */
export type TtscTurbopackLoaderOptions = TtscUnpluginOptions;
