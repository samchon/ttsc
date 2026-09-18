import type { ViteEnvironmentLike } from "./ViteEnvironmentLike";
import type { ViteHotChannelLike } from "./ViteHotChannelLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";

/**
 * Minimal structural view of the Vite dev server. Declared locally instead of
 * importing `vite` so the published type declarations never require Vite to be
 * installed, and so one shape spans the mixed module graph (Vite 5), the
 * environment API (Vite 6+), and whichever of `ws`/`hot` a major still
 * carries.
 */
export interface ViteDevServerLike {
  /** Resolved config; only `root` is read, to anchor the project scope. */
  config?: { root?: string };
  /** Per-environment graphs and channels under the environment API (Vite 6+). */
  environments?: Record<string, ViteEnvironmentLike>;
  /** The deprecated server-level hot channel some majors still carry. */
  hot?: ViteHotChannelLike;
  /** The mixed module graph of Vite 5. */
  moduleGraph?: ViteModuleGraphLike;
  /** The websocket channel of Vite 5 and earlier. */
  ws?: ViteHotChannelLike;
}
