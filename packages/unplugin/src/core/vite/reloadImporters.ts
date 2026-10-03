import type { ViteDevServerLike } from "./ViteDevServerLike";
import type { ViteModuleGraphLike } from "./ViteModuleGraphLike";
import type { ViteModuleNodeLike } from "./ViteModuleNodeLike";
import { invalidateImporters } from "./invalidateImporters";
import { selectModulesByFile } from "./selectModulesByFile";
import { sendFullReload } from "./sendFullReload";

/**
 * Request propagation of selected importer nodes through Vite's reload API
 * (samchon/ttsc#1393); Vite owns acceptance and client effects.
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
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Importer filesystem spellings enter selectModulesByFile's normalized exact
 *   lookup and native identity fallback; environment nodes remain opaque and
 *   are delivered to their owning host, without replacing their file spelling.
 * @evidence contracts/performance.md#efficient-algorithms
 *   E environment targets and I importers yield E-times-I lookups; a missed
 *   exact lookup scans G keys with native identity queries. N selected node
 *   occurrences allocate N promises; aliases may select the same node again.
 *   Failure adds the delegated invalidation scan and channel fanout.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This operation schedules effectful owning-host reloads, not a reusable
 *   computed result; equal importer spellings across graphs do not establish
 *   equivalent host effects. It keeps no cross-request proof or result cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The selected targets and N queued reload tasks have no concurrency/count
 *   cap or cancellation here. Pending promise reactions retain host/node or
 *   fallback references until settlement; early rejection cannot cancel the
 *   other host reloads. No native watch handle is acquired by this routing step.
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
