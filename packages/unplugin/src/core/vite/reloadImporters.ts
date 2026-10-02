import type { ViteDevServerLike } from "./ViteDevServerLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";
import { invalidateImporters } from "./invalidateImporters";
import { selectModulesByFile } from "./selectModulesByFile";
import { sendFullReload } from "./sendFullReload";

/**
 * Update every loaded module of the given importers through Vite's own
 * propagation, exactly as an edit to those modules would (samchon/ttsc#1393).
 *
 * A compiler-only input, such as an interface a typia validator is generated
 * from, used to reload the whole page, so every client lost its state even
 * where the importer sat inside an HMR boundary. Each environment's
 * `reloadModule` (Vite 6+), or the server's (Vite 5), now receives the
 * importer's nodes. Vite then decides acceptance boundaries, SSR handling, and
 * whether a full reload is due. A host without that API, a server with `hmr:
 * false`, or a reload that fails, falls back to invalidating the importers and
 * requesting a full reload.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Nodes are passed to their owning environment/server reload operation so
 *   Vite decides HMR acceptance. Disabled HMR, absent APIs and rejected promises
 *   retain the supported invalidate-plus-full-reload behavior.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Recipient discovery precedes scheduling, and one fallback owns the degraded
 *   path rather than duplicating transport policy at each missing capability.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Fallback handles an actual unsupported host capability or reload failure;
 *   it does not fabricate HMR success or mutate foreign acceptance internals.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain importer propagation, preserved client state and
 *   fallback conditions, with separate tags following documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Visits each module of the file's importers once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
 */
export function reloadImporters(
  server: ViteDevServerLike,
  importers: ReadonlySet<string>,
): void {
  const fallback = (): void => {
    invalidateImporters(server, importers);
    sendFullReload(server);
  };
  if (server.config?.server?.hmr === false) {
    fallback();
    return;
  }
  const targets: {
    graph: ViteModuleGraphLike;
    reload: (node: ViteModuleNodeLike) => Promise<void>;
  }[] = [];
  const environments = Object.values(server.environments ?? {});
  for (const environment of environments) {
    if (environment?.moduleGraph === undefined) continue;
    if (typeof environment.reloadModule !== "function") {
      fallback();
      return;
    }
    targets.push({
      graph: environment.moduleGraph,
      reload: (node) => environment.reloadModule!(node),
    });
  }
  if (targets.length === 0) {
    if (
      server.moduleGraph === undefined ||
      typeof server.reloadModule !== "function"
    ) {
      fallback();
      return;
    }
    targets.push({
      graph: server.moduleGraph,
      reload: (node) => server.reloadModule!(node),
    });
  }
  const reloads: Promise<void>[] = [];
  for (const { graph, reload } of targets) {
    for (const importer of importers) {
      for (const node of selectModulesByFile(graph, importer)) {
        reloads.push(Promise.resolve().then(() => reload(node)));
      }
    }
  }
  Promise.all(reloads).catch(fallback);
}
