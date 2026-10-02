import type { TurbopackLikeConfig } from "./TurbopackLikeConfig";
import type { WebpackLikeConfig } from "./WebpackLikeConfig";

/**
 * Minimal structural type for a Next.js configuration object.
 *
 * Only `webpack` and `turbopack` are used by this adapter; all other Next.js
 * options are forwarded as-is through the spread operator.
 *
 * @evidence contracts/common.md#principled-implementation
 *   An open record preserves unrelated Next settings while typed webpack and
 *   Turbopack members identify the two extension boundaries this wrapper changes.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Only consumed configuration surfaces are modeled; complete Next types remain
 *   the caller's concern rather than a mandatory dependency for other adapters.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The declared hooks are supported configuration boundaries, not private mutations.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose and spaced members explain preservation and hook ordering,
 *   with tag separation following the documentation skill.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   NextLikeConfig only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   NextLikeConfig only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   NextLikeConfig only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   NextLikeConfig only declares a shape; it has no handle or retained state
 *   at runtime.
 */
export type NextLikeConfig = Record<string, unknown> & {
  /**
   * Optional existing webpack customisation hook. When the caller has already
   * defined one, `next()` will chain through to it after injecting the ttsc
   * webpack plugin.
   */
  webpack?: (config: WebpackLikeConfig, options: unknown) => WebpackLikeConfig;

  /**
   * Optional existing Turbopack configuration. Preserved whole; only the ttsc
   * rules are merged into its `rules` map.
   */
  turbopack?: TurbopackLikeConfig;
};
