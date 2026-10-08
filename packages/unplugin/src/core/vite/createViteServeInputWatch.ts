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
 * included. A reload verdict requests importer-node propagation through Vite
 * (`reloadImporters`, samchon/ttsc#1393); Vite decides HMR acceptance and
 * client effects. A remaining membership invalidation verdict only invalidates
 * graph nodes (`invalidateImporters`, samchon/ttsc#1419), without proving that
 * the actual root set changed or requesting an HMR update.
 *
 * A watching server opens the observer on its root before compilation begins. A
 * watcherless server (`server.watch: null`) registers no notification inputs
 * and releases any preceding server's observer. A server told to poll registers
 * inputs for the observer's per-tick bounded poll (samchon/ttsc#1395).
 *
 * @param operations Native watch seams, replaceable for tests.
 * @evidence contracts/common.md#principled-implementation
 *   Compiler-only inputs belong to the shared observer, while verdicts route to
 *   Vite's importer lookup. Reload verdicts request HMR propagation and
 *   remaining membership verdicts attempt invalidation without inventing
 *   runtime imports; absent or failed host APIs can limit those effects.
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
 *   Configured root or native cwd enters the shared observer. Watch, polling,
 *   platform and case-policy seams must agree with the native input corpus;
 *   they do not replace the observer's default filesystem reads. Neither an OS
 *   label nor declared polling proves a universal notification or case policy.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Verdict sets deduplicate importer spellings before graph work. For E host
 *   graphs and I importers, lookup can scan G file keys per missed exact lookup
 *   with native identity comparisons; selected nodes create reload promises.
 *   Registration and polling delegate input indexing, evidence serialization,
 *   native metadata/content checks and per-tick probe limits to the observer.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   One observer shares compiler-input subscriptions across served modules using
 *   their generation evidence; replace supplies the capture token so stale
 *   registration does not acknowledge a change since compilation began.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Watcherless attachment clears preceding registrations and releases their
 *   scopes and poller; it acquires none. Watching attachment retains
 *   precompilation observation. The observer retains input/evidence/owner indexes
 *   and bounded scope/history populations, without a total input-byte bound. Forget removes that owner's
 *   claims; dispose clears entries/timers and attempts independent handle closes,
 *   suppressing close errors. Server/root association survives for re-registration
 *   during overlap; reload tasks already handed to Vite are not cancelled here.
 */
export function createViteServeInputWatch(
  operations: Partial<InputObserverOperations> = {},
): ViteServeInputWatch {
  let server: ViteDevServerLike | undefined;
  let watching = false;
  const observer = createInputObserver(({ invalidate, reload }) => {
    if (server === undefined) return;
    if (reload.size !== 0) reloadImporters(server, reload);
    if (invalidate.size !== 0) invalidateImporters(server, invalidate);
  }, operations);
  return {
    attach(next) {
      server = next;
      watching = next.config?.server?.watch !== null;
      if (!watching) {
        // dispose clears registrations and closes handles synchronously; its
        // Promise exposes the common observer lifecycle to asynchronous owners.
        void observer.dispose();
        return;
      }
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
    replace: (importer, inputs, failed, startedAt) => {
      if (watching) observer.replace(importer, inputs, failed, startedAt);
    },
  };
}
