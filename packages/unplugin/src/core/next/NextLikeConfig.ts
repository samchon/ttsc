import type { TurbopackLikeConfig } from "./TurbopackLikeConfig";
import type { WebpackLikeConfig } from "./WebpackLikeConfig";

/**
 * Minimal structural type for a Next.js configuration object.
 *
 * Only `webpack` and `turbopack` are used by this adapter; all other Next.js
 * own enumerable options are shallow-copied through the spread operator; nested
 * values remain shared.
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
 *   Defines public host configuration hooks and an opaque Turbopack block,
 *   not native path identity or filesystem capability. Native loader/record
 *   handling belongs to the wrapper and plugin implementations.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   next owns the shallow setting copy, webpack plugin insertion and rule
 *   merging; the open hook/config representation selects no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This configuration shape defines no cache or identity. Wrapper-local
 *   loader-resolution sharing and generation validity have separate owners.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The host owns the returned configuration/hooks; loader sessions and native
 *   resources are acquired by implementations, not this representation.
 */
export type NextLikeConfig = Record<string, unknown> & {
  /**
   * Optional existing webpack customisation hook. When the caller has already
   * defined one, `next()` will chain through to it after injecting the ttsc
   * webpack plugin.
   */
  webpack?: (config: WebpackLikeConfig, options: unknown) => WebpackLikeConfig;

  /**
   * Optional existing Turbopack configuration. Its own enumerable settings are
   * shallow-copied while the ttsc rules are merged into a copied `rules` map.
   */
  turbopack?: TurbopackLikeConfig;
};
