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
 * @evidence contracts/portability.md#os-neutral-implementation
 *   config.root carries the native project scope, with cwd fallback at adapter
 *   attachment. Explicit usePolling withdraws notification trust; it is a host
 *   declaration, not measured filesystem capability. No separator/case policy
 *   is inferred, while HMR payloads and opaque graph nodes keep host meanings.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ViteDevServerLike only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ViteDevServerLike only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ViteDevServerLike only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface ViteDevServerLike {
  /**
   * Resolved config. `root` anchors the project scope,
   * `server.watch.usePolling` declares that native notifications cannot be
   * trusted on this filesystem, and `server.hmr: false` selects the adapter's
   * invalidation/full-reload fallback instead of HMR propagation.
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

  /** Server-level channel; available environment channels take precedence. */
  hot?: ViteHotChannelLike;

  /** The mixed module graph, primary in Vite 5 and kept for compatibility after. */
  moduleGraph?: ViteModuleGraphLike;

  /**
   * Run Vite's own update propagation for one mixed-graph module (Vite 5), as
   * an explicit HMR request (samchon/ttsc#1393). Its Promise represents the host
   * operation, not a native edit or client update acknowledgment.
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
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of reloadModule is declared here; the platform
   *   behaviour belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of reloadModule is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of reloadModule is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of reloadModule is declared here; the cost belongs to
   *   its implementation.
   */
  reloadModule?(node: ViteModuleNodeLike): Promise<void>;

  /** Optional server websocket channel used by the legacy reload fallback. */
  ws?: ViteHotChannelLike;
}
