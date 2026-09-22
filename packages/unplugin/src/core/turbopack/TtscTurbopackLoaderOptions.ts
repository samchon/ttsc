import type { TtscUnpluginOptions } from "../options/TtscUnpluginOptions";

/**
 * The options a Turbopack rule hands the loader: the adapter's own options,
 * passed through the rule's `options` object by `withTtsc` or by a rule wired
 * by hand.
 */
export type TtscTurbopackLoaderOptions = TtscUnpluginOptions;
