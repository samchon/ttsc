import type { TtscTransformCache } from "./TtscTransformCache";

/**
 * The current delivery epoch of each cache whose owner has declared a real
 * per-pass lifecycle by calling {@link beginTtscTransformBuild}.
 *
 * A _delivery epoch_ is one bundler pass: the window inside which each module
 * is requested at most once, so its first delivery may be settled against the
 * state the pass started from. It is deliberately not the same fact as whether
 * the generation is still valid, which the recorded snapshot answers.
 * Conflating the two is what made every host with a repeating `buildStart` —
 * webpack and Rspack watch, Rollup and Rolldown watch, `vite build --watch`,
 * esbuild rebuild — discard a perfectly good whole-project compile on every
 * edit (samchon/ttsc#1300).
 *
 * Absent from the map means persistent validation: a host with no pass boundary
 * at all (a watching Vite dev server, Metro, the Turbopack loader), where every
 * delivery proves the generation for itself.
 */
export const TRANSFORM_CACHE_EPOCHS = new WeakMap<TtscTransformCache, number>();
