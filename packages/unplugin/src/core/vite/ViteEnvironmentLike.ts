import type { ViteHotChannelLike } from "./ViteHotChannelLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/**
 * One dev-server environment (client, ssr, or a custom one).
 * Its module nodes stay opaque and must return to the graph owner's reload
 * operation. These capabilities do not acknowledge client update completion.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Graph, hot channel and reload callback belong to the same environment so
 *   source nodes are handed back to the owner that controls their HMR behavior.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The structural record groups related environment capabilities without
 *   duplicating Vite's complete environment model.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Optional capabilities model actual host differences, not a synthetic HMR result.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose identifies environment kinds and spaced members explain
 *   ownership and reload behavior per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This record associates an opaque host graph with reload/transport
 *   capabilities. It defines no native path representation, filesystem case
 *   policy or process boundary; graph-key meaning remains with the graph API.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ViteEnvironmentLike only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ViteEnvironmentLike only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ViteEnvironmentLike only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface ViteEnvironmentLike {
  /** Channel to this environment's clients. */
  hot?: ViteHotChannelLike;

  /** This environment's module graph. */
  moduleGraph?: ViteModuleGraphLike;

  /**
   * Run Vite's own update propagation for one of this environment's modules
   * (Vite 6+) (samchon/ttsc#1393). This requests the host's HMR operation, not a
   * native file edit or acknowledgment that every client applied an update.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Passing an opaque environment node to its reload operation delegates HMR
   *   boundary decisions to Vite; the promise represents async propagation.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One operation exposes propagation rather than acceptance-graph internals.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Callers use Vite's own reload capability rather than fabricating updates.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native prose states ownership and HMR request scope, separated from
   *   tags and members according to documentation guidance.
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
}
