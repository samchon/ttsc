import type { ViteDevServerLike } from "./ViteDevServerLike";
import { selectModuleGraphs } from "./selectModuleGraphs";
import { selectModulesByFile } from "./selectModulesByFile";

/**
 * Invalidate every module-graph node of the registered importers so the next
 * request retransforms them. Importers keep their original absolute spelling so
 * the module graph's exact-key lookup can hit; graph lookups still go through
 * {@link selectModulesByFile} because module-graph file keys are
 * slash-normalized and, on case-insensitive filesystems, may not match the
 * compiler's spelling byte for byte.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Every selected graph receives the importer nodes resolved through its own
 *   lookup boundary; Vite owns invalidation and opaque node state.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Nested graph/importer/node iteration expresses the complete recipient set
 *   while graph and filesystem selection remain shared helpers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Per-node errors do not patch a graph; a reload caller can still request a
 *   full refetch. A host lacking invalidation cannot be certified as invalidated.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose explains original spelling and lookup ownership; the nearby
 *   error comment states the fallback limit with documentation-guided separation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Visits each module of the file's importers once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function invalidateImporters(
  server: ViteDevServerLike,
  importers: ReadonlySet<string>,
): void {
  for (const graph of selectModuleGraphs(server)) {
    for (const importer of importers) {
      for (const node of selectModulesByFile(graph, importer)) {
        try {
          graph.invalidateModule?.(node);
        } catch {
          // A graph shape this structural view mispredicts must not crash the
          // poll. As the fallback of `reloadImporters` the full reload sent
          // after this still forces a refetch. On a membership-only
          // invalidation nothing follows, so an importer whose node failed to
          // invalidate keeps Vite's cached transform until something else
          // invalidates it.
        }
      }
    }
  }
}
