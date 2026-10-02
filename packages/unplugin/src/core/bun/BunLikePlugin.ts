import type { BunLikeBuild } from "./BunLikeBuild";

/**
 * Minimal subset of the Bun plugin API consumed by this adapter.
 *
 * The local structural subset keeps the adapter free of a Bun runtime/type
 * dependency while describing the registration values it supplies.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A name and setup callback represent the Bun plugin entry used by bundler
 *   and runtime registration; setup accepts their shared build subset.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The local structural interface exposes only what this adapter supplies.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The callback is Bun's registration boundary, not a patched runtime method.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies the dependency boundary, and spaced member
 *   comments describe registration and naming per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   BunLikePlugin only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   BunLikePlugin only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   BunLikePlugin only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   BunLikePlugin only declares a shape; it has no handle or retained state
 *   at runtime.
 */
export interface BunLikePlugin {
  /** Plugin identifier shown in Bun bundler output. */
  name: string;

  /**
   * Called by Bun when the plugin is registered.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The build parameter carries the hook registration API and the promise
   *   union allows asynchronous setup accepted by the host.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One callback owns setup rather than exposing individual loader mutations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Setup uses the host-supplied plugin builder as its extension boundary.
   * @evidence contracts/common.md#meaningful-documentation
   *   The method comment names its registration timing; native syntax and a
   *   blank tag separator follow documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of setup is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of setup is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of setup is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of setup is declared here; the cost belongs to its
   *   implementation.
   */
  setup(build: BunLikeBuild): void | Promise<void>;
}
