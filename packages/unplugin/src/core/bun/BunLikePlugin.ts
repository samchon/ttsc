import type { BunLikeBuild } from "./BunLikeBuild";

/**
 * Minimal subset of the Bun plugin API consumed by this adapter.
 *
 * Bun does not yet ship TypeScript types for its bundler plugin interface, so
 * we define the subset we need here. This keeps the adapter free of a Bun
 * runtime dependency while remaining type-safe.
 */
export interface BunLikePlugin {
  /** Plugin identifier shown in Bun bundler output. */
  name: string;
  /** Called by Bun when the plugin is registered. */
  setup(build: BunLikeBuild): void | Promise<void>;
}
