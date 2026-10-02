import type { ViteDevServerLike } from "./ViteDevServerLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";

/**
 * Enumerate the server's module graphs: one per environment under the
 * environment API (Vite 6+), otherwise the mixed module graph (Vite 5).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Available environment graphs take precedence; an absent environment graph
 *   population falls back to the supported mixed-graph server capability.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One selector owns version-shape precedence for all graph consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Fallback reflects Vite's actual supported API shapes, not patched graph fields.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native prose states graph precedence and version context with descriptive
 *   prose separated from tags per documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Enumerating E environments takes O(E) visits and temporary references;
 *   the output retains each present graph occurrence, without identity dedup.
 *   The mixed graph is appended only when that output is empty.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Selecting current host graph references coordinates no reusable
 *   computation or in-flight work across requests.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function selectModuleGraphs(
  server: ViteDevServerLike,
): ViteModuleGraphLike[] {
  const graphs: ViteModuleGraphLike[] = [];
  for (const environment of Object.values(server.environments ?? {})) {
    if (environment?.moduleGraph !== undefined) {
      graphs.push(environment.moduleGraph);
    }
  }
  if (graphs.length === 0 && server.moduleGraph !== undefined) {
    graphs.push(server.moduleGraph);
  }
  return graphs;
}
