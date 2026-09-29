import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";

/**
 * The module-graph surface this module touches, shared by Vite's mixed module
 * graph and the per-environment graphs of the environment API.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Optional exact lookup, file map and invalidation capability describe the
 *   operations available across mixed and environment-specific Vite graphs.
 * @evidence contracts/common.md#clear-and-simple-design
 *   A structural subset keeps opaque nodes and graph operations together without
 *   depending on one Vite major's full internal types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Consumers use exposed graph operations; the type does not offer node mutation.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains versioned graph ownership; spaced member comments name
 *   fast lookup and fallback scanning per documentation guidance.
 */
export interface ViteModuleGraphLike {
  /**
   * Every file with its module nodes, scanned when the fast lookup misses a
   * spelling.
   */
  fileToModulesMap?: Map<string, Set<ViteModuleNodeLike>>;

  /**
   * Fast exact lookup by slash-normalized file path.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A set preserves all graph nodes for one file, with undefined representing
   *   an absent mapping so callers can try the exposed file map.
   * @evidence contracts/common.md#clear-and-simple-design
   *   The signature exposes lookup without requiring a graph storage layout.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   This is a host lookup capability, not access to a private resolver hook.
   * @evidence contracts/common.md#meaningful-documentation
   *   The comment states normalized path spelling; parent member docs explain
   *   fallback purpose, with native spacing per documentation guidance.
   */
  getModulesByFile?(file: string): Set<ViteModuleNodeLike> | undefined;

  /**
   * Drop a node's cached transform so the next request retransforms it.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The opaque node is returned to its owning graph, which owns transform
   *   invalidation; the optional member represents an absent host capability.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One method keeps invalidation with the graph rather than exposing cache fields.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Callers use Vite's operation instead of replacing or clearing foreign internals.
   * @evidence contracts/common.md#meaningful-documentation
   *   The native comment explains the next-request effect and separates tags,
   *   following the documentation skill's member presentation guidance.
   */
  invalidateModule?(node: ViteModuleNodeLike): void;
}
