import type { InputObserverOperations } from "../observer/InputObserverOperations";
import { createInputObserver } from "../observer/createInputObserver";
import { hostDeclaresPolling } from "../transform/tracker/hostDeclaresPolling";
import type { ViteDevServerLike } from "./ViteDevServerLike";
import type { ViteServeInputWatch } from "./ViteServeInputWatch";
import { invalidateImporters } from "./invalidateImporters";
import { reloadImporters } from "./reloadImporters";

/**
 * The Vite dev server's observer of compiler inputs, shared by all served
 * modules.
 *
 * Vite resolves transform-context `addWatchFile` as a runtime import, including
 * type-only `.server` files and non-module plugin assets, so compiler inputs
 * never go through it (samchon/ttsc#1368). Each importer registers them with
 * the adapter's own observer instead (`createInputObserver`), `node_modules`
 * included, which Vite's watcher ignores, and the observer's verdict reaches
 * Vite through its own graph: an importer whose input changed is updated as an
 * edit to it would be (`reloadImporters`, samchon/ttsc#1393), and one whose
 * project only gained or lost a root file is invalidated without an HMR update,
 * since most new files change no other module (`invalidateImporters`,
 * samchon/ttsc#1419).
 *
 * The observer opens on the server's root once a server attaches, and a server
 * told to poll sends every input to the observer's bounded poll
 * (samchon/ttsc#1395).
 *
 * @param operations Native watch seams, replaceable for tests.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Compiler-only inputs belong to the shared observer, while verdicts route to
 *   Vite's actual importer nodes. Content changes request HMR propagation and
 *   membership-only changes invalidate without inventing runtime imports.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The wrapper owns server association and verdict routing; input observation,
 *   graph lookup and reload transport remain dedicated operations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Real host polling capabilities select observation; compiler assets are not
 *   attached to Vite's runtime graph merely to compensate for watcher omissions.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain graph ownership, membership behavior and polling;
 *   returned interface docs and separated tags follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Configured root or native cwd enters the shared observer. Injected filesystem
 *   and watcher seams judge actual capability; the wrapper assumes no universal
 *   path case policy or cross-platform native notification guarantee.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Verdict sets deduplicate changed importers before graph work; subscription
 *   indexing and bounded watch handles remain owned by createInputObserver.
 *   Fallback graph lookup can scan G files for each unmatched importer.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One observer shares compiler-input subscriptions across served modules using
 *   their generation evidence; replace supplies the capture token so stale
 *   registration does not acknowledge a change since compilation began.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   This wrapper owns the observer; forget releases an importer's registrations
 *   and dispose releases scopes, timers and entries. The server association is
 *   retained across overlapping containers; retained bytes grow with inputs.
 */
export function createViteServeInputWatch(
  operations: Partial<InputObserverOperations> = {},
): ViteServeInputWatch {
  let server: ViteDevServerLike | undefined;
  const observer = createInputObserver(({ invalidate, reload }) => {
    if (server === undefined) return;
    if (reload.size !== 0) reloadImporters(server, reload);
    if (invalidate.size !== 0) invalidateImporters(server, invalidate);
  }, operations);
  return {
    attach(next) {
      server = next;
      observer.open(
        next.config?.root ?? process.cwd(),
        hostDeclaresPolling(
          process.env,
          next.config?.server?.watch?.usePolling === true,
        ),
      );
    },
    begin: () => observer.begin(),
    // The attached server is kept across overlapping Vite restart containers.
    dispose: () => observer.dispose(),
    forget: (importer) => observer.forget(importer),
    replace: (importer, inputs, failed, startedAt) =>
      observer.replace(importer, inputs, failed, startedAt),
  };
}
