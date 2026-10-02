import type { ViteDevServerLike } from "./ViteDevServerLike";
import { selectModuleGraphs } from "./selectModuleGraphs";
import { selectModulesByFile } from "./selectModulesByFile";

/**
 * Attempt invalidation of selected module-graph nodes so a capable host can
 * retransform them on a later request. Importers keep their original spelling so
 * the module graph's exact-key lookup can hit; graph lookups still go through
 * {@link selectModulesByFile} because module-graph file keys are
 * slash-normalized and native aliases or filesystem case policy may differ
 * from the compiler's spelling byte for byte. Missing or throwing invalidation
 * APIs cannot guarantee that Vite's cached transform was discarded.
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
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Importer spellings enter the selector's slash-normalized exact lookup and
 *   native identity fallback; original opaque nodes stay with their owning graph.
 * @evidence contracts/performance.md#efficient-algorithms
 *   E selected graph occurrences and I importer spellings produce E-times-I
 *   lookups; missed exact lookups can scan G keys with native identity queries.
 *   Each of N returned node occurrences invokes host invalidation independently,
 *   so graph aliases and overlapping importer results can repeat effects.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This step requests effectful invalidation, not a reusable computed result;
 *   opaque graph/node equality does not supply cross-request validity proof.
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
