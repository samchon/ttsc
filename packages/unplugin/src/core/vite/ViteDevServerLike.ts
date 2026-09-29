import type { ViteEnvironmentLike } from "./ViteEnvironmentLike";
import type { ViteHotChannelLike } from "./ViteHotChannelLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/**
 * Minimal structural view of the Vite dev server. Declared locally instead of
 * importing `vite` so the published type declarations never require Vite to be
 * installed, and so one shape spans the mixed module graph (Vite 5), the
 * environment API (Vite 6+), and whichever of `ws`/`hot` a major still
 * carries.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional mixed-graph and environment capabilities represent the supported
 *   major-version shapes; config communicates root, polling and disabled HMR.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A local structural boundary avoids requiring a Vite installation for other
 *   bundlers and exposes only what compiler-input observation consumes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Capability selection handles supported Vite shapes through their own APIs
 *   rather than changing private server behavior.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains dependency/version boundaries and each member's role;
 *   separate comments and tag spacing follow documentation guidance.
 */
export interface ViteDevServerLike {
  /**
   * Resolved config. `root` anchors the project scope,
   * `server.watch.usePolling` declares that native notifications cannot be
   * trusted on this filesystem, and `server.hmr: false` turns module updates
   * off.
   */
  config?: {
    root?: string;
    server?: {
      hmr?: unknown;
      watch?: { usePolling?: boolean } | null;
    };
  };

  /** Per-environment graphs and channels under the environment API (Vite 6+). */
  environments?: Record<string, ViteEnvironmentLike>;

  /** The server-level channel; in Vite 6+ an alias of the client environment's. */
  hot?: ViteHotChannelLike;

  /** The mixed module graph, primary in Vite 5 and kept for compatibility after. */
  moduleGraph?: ViteModuleGraphLike;

  /**
   * Run Vite's own update propagation for one mixed-graph module (Vite 5), as
   * an edit to its file would (samchon/ttsc#1393).
   *
   * @evidence contracts/common.md#principled-implementation
   *   A mixed-graph node is handed to the owning server's asynchronous propagation
   *   operation; optionality preserves servers with environment-only capabilities.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One operation exposes the older server-level HMR boundary directly.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The host determines update acceptance rather than patched graph fields.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose describes the graph and version context, with member/tag
   *   separation following the documentation skill.
   */
  reloadModule?(node: ViteModuleNodeLike): Promise<void>;

  /** The websocket channel to connected clients, present in every major. */
  ws?: ViteHotChannelLike;
}
