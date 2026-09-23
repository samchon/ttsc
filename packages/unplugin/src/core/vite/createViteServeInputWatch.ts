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
