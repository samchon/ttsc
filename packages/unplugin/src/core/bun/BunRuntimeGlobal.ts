import type { BunLikePlugin } from "./BunLikePlugin";

/**
 * Minimal shape of the Bun runtime global used to register a runtime plugin.
 *
 * Declared locally so the package needs no `bun-types` dependency; at runtime
 * Bun exposes `Bun.plugin`, which accepts the same object the bundler adapter
 * returns.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The single callable plugin member is the runtime capability detection and
 *   registration consume; unrelated Bun services are outside this boundary.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A structural subset avoids introducing a Bun runtime dependency for Node.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The interface describes the host's supported registration API rather than
 *   exposing runtime internals for replacement.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain the dependency choice and first-loader behavior,
 *   with description and checklist tags separated per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Plugin installation is an ordinary host extension boundary with no native
 *   filename, process handle or case-policy field; loaders own native IO.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Runtime installation and the supplied descriptor's setup own their work;
 *   this callable capability specifies no lookup/transform strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   registrationState/ensureRegistered own per-runtime installation sharing;
 *   the callable capability alone establishes no cached installation outcome.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   The runtime owns retained installed hooks and adapter setup owns loader
 *   state; this interface grants no independent shutdown or handle ownership.
 */
export interface BunRuntimeGlobal {
  /**
   * Install one plugin on the runtime's module loader.
   *
   * Bun uses the first matching `onLoad` hook and does not fall through, so the
   * registration state avoids duplicate accepted or in-flight installation. A
   * synchronous installation failure resets the guard and permits retry; this
   * void boundary does not await an asynchronous installation outcome.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A plugin descriptor is the value Bun consumes to install loader hooks;
   *   void expresses registration rather than ownership of a transform result.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One method exposes only the installation capability the runtime path needs.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   It models supported plugin registration, not foreign method replacement.
   * @evidence contracts/common.md#meaningful-documentation
   *   The method explains why callers register once and preserves native JSDoc
   *   paragraphs and tag spacing required by documentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of plugin is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of plugin is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of plugin is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of plugin is declared here; the cost belongs to its
   *   implementation.
   */
  plugin(plugin: BunLikePlugin): void;
}
