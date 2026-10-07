import type { TtscTransformHooks } from "../transform/watch/TtscTransformHooks";
import type { ViteServeInputWatch } from "./ViteServeInputWatch";

/**
 * Select Vite's compiler-input channel without adding executable import edges.
 *
 * A watching serve delivery binds its readonly input batch to the existing
 * observer's replacement operation and requests membership. A watcherless serve
 * delivery supplies no input hooks. Other commands return undefined so the
 * caller can construct its build-project handoff at its original boundary.
 *
 * The binding preserves the delivered spelling, precompile sequence token,
 * input batch and failure flag. It does not acquire an observer or certify
 * native notifications, and build records and volatility remain caller-owned.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Serve compiler inputs use the observer replacement channel instead of the
 *   runtime addWatchFile channel. No watcher means no registration; non-serve
 *   selection leaves the build-project handoff with its existing owner.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One mode decision returns a serve binding, an empty serve shape or the
 *   explicit non-serve discriminator needed for lazy build-hook construction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The binding invokes the supplied observer's existing method with its own
 *   receiver and unchanged facts; it fabricates no import, capture or proof.
 * @evidence contracts/common.md#meaningful-documentation
 *   Prose explains mode distinctions, sequence and callback ownership and the
 *   separation from runtime imports, build records and native observation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   This operation forwards opaque path spelling and an observer sequence;
 *   native root, filesystem identity and watch admission belong to the observer.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Selection creates at most one callback without scanning input batches. Each
 *   invocation delegates the observer's actual replacement and callback costs;
 *   the closure borrows its fixed importer, sequence and observer references.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Each delivery binds its own importer and compile-start sequence. No memo is
 *   kept and no matching input list authorizes dropping notification effects.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   A returned hook retains its importer, sequence and observer reference until
 *   its borrower releases it. It opens no handle; the observer owner disposes
 *   registrations and pollers independently of this callback's lifetime.
 */
export function createViteServeWatchHooks(
  command: string | undefined,
  watching: boolean,
  serveInputs: Pick<ViteServeInputWatch, "replace">,
  file: string,
  startedAt: number | undefined,
): Pick<TtscTransformHooks, "addWatchFiles" | "membership"> | undefined {
  if (command !== "serve") return undefined;
  if (!watching) return {};
  return {
    addWatchFiles: (inputs, failed) =>
      serveInputs.replace(file, inputs, failed, startedAt),
    membership: true,
  };
}
