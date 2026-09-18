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
  /**
   * Resolved config. `root` anchors the project scope, and
   * `server.watch.usePolling` declares that native notifications cannot be
   * trusted on this filesystem.
   */
  config?: {
    root?: string;
    server?: { watch?: { usePolling?: boolean } | null };
  };
  /** Per-environment graphs and channels under the environment API (Vite 6+). */
  environments?: Record<string, ViteEnvironmentLike>;
  /** The server-level channel; in Vite 6+ an alias of the client environment's. */
  hot?: ViteHotChannelLike;
  /** The mixed module graph, primary in Vite 5 and kept for compatibility after. */
  moduleGraph?: ViteModuleGraphLike;
  /** The websocket channel to connected clients, present in every major. */
  ws?: ViteHotChannelLike;
}
