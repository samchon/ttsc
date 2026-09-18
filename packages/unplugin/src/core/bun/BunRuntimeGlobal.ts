import type { BunLikePlugin } from "./BunLikePlugin";

/**
 * Minimal shape of the Bun runtime global used to register a runtime plugin.
 *
 * Declared locally so the package needs no `bun-types` dependency; at runtime
 * Bun exposes `Bun.plugin`, which accepts the same object the bundler adapter
 * returns.
 */
export interface BunRuntimeGlobal {
  /**
   * Install one plugin on the runtime's module loader.
   *
   * Bun uses the first matching `onLoad` hook and does not fall through, so the
   * registration state calls this at most once per runtime.
   */
  plugin(plugin: BunLikePlugin): void;
}
