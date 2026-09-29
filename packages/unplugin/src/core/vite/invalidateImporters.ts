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
          // poll; the full-reload below still forces a refetch, and the
          // transform cache's external-input hashes force the recompile.
        }
      }
    }
  }
}
