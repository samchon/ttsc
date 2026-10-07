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
 * @evidence contracts/portability.md#os-neutral-implementation
 *   File keys and the lookup parameter represent host file paths at Vite's
 *   normalized graph boundary, not module URLs or query-qualified IDs. Physical
 *   alias/case comparison belongs to the selector's filesystem identity owner;
 *   this type does not equate slash spelling with native file identity.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   ViteModuleGraphLike only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   ViteModuleGraphLike only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   ViteModuleGraphLike only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface ViteModuleGraphLike {
  /**
   * Exposed file mappings with their module nodes, scanned when the fast lookup
   * misses a spelling. The shape does not certify map completeness.
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
   * @evidence contracts/portability.md#os-neutral-implementation
   *   The parameter is a host file spelling at the normalized graph boundary;
   *   URL/query parsing and guessed OS-wide filesystem case are not its meaning.
   *   An absent exact mapping leaves physical alias resolution to the caller.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of getModulesByFile is declared here; the cost belongs
   *   to its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of getModulesByFile is declared here; the cost belongs
   *   to its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of getModulesByFile is declared here; the cost belongs
   *   to its implementation.
   */
  getModulesByFile?(file: string): Set<ViteModuleNodeLike> | undefined;

  /**
   * Request the owning graph to invalidate an opaque node's cached transform.
   * The optional operation does not itself certify the next request's
   * behavior.
   *
   * @evidence contracts/common.md#principled-implementation
   *   The opaque node is returned to its owning graph, which owns transform
   *   invalidation; the optional member represents an absent host capability.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One method keeps invalidation with the graph rather than exposing cache fields.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Callers use Vite's operation instead of replacing or clearing foreign internals.
   * @evidence contracts/common.md#meaningful-documentation
   *   The native comment explains the host-owned invalidation request and separates tags,
   *   following the documentation skill's member presentation guidance.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of invalidateModule is declared here; the platform
   *   behaviour belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of invalidateModule is declared here; the cost belongs
   *   to its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of invalidateModule is declared here; the cost belongs
   *   to its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of invalidateModule is declared here; the cost belongs
   *   to its implementation.
   */
  invalidateModule?(node: ViteModuleNodeLike): void;
}
