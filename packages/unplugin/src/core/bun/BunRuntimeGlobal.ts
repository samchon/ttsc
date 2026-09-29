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
 */
export interface BunRuntimeGlobal {
  /**
   * Install one plugin on the runtime's module loader.
   *
   * Bun uses the first matching `onLoad` hook and does not fall through, so the
   * registration state calls this at most once per runtime.
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
   */
  plugin(plugin: BunLikePlugin): void;
}
