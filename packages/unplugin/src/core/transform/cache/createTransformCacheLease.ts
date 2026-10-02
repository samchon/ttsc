import type { TtscTransformCache } from "./TtscTransformCache";
import type { TtscTransformCacheLease } from "./TtscTransformCacheLease";
import { resetTtscTransformCache } from "./resetTtscTransformCache";

/**
 * How long a build-scoped generation outlives its last session
 * (samchon/ttsc#1396).
 *
 * Measured with `next build --webpack`, the next compiler applied its plugins
 * 456 ms after the previous one shut down, and Vite builds an app's
 * environments back to back. The grace only decides whether the next session
 * reuses the generation; that session proves it against the filesystem before
 * serving a module, so the value affects cost, never correctness.
 */
const RELEASE_GRACE_MS = 2_000;

/**
 * Tie a build-scoped cache's lifetime to the sessions that use it, rather than
 * to one session (samchon/ttsc#1396).
 *
 * A multi-environment `vite build`, and Next's client, server, and edge
 * compilers, each ran a session of their own over the same program, and each
 * one discarded the generation at its end, so the next compiled the whole
 * project again. A build-scoped generation holds no watcher and no other
 * operating-system resource: only memory. So when the last session releases it,
 * it is kept for a short grace. A session acquired within that grace opens its
 * own delivery pass, and the pass's first delivery proves the kept generation
 * against the filesystem. A cache still unowned after the grace is reset.
 * Optional registry hooks observe acquisition and final idle reclamation;
 * they do not change the generation's validation or the lease's owner count.
 *
 * @evidence contracts/common.md#principled-implementation Active-session counting prevents premature reset, and final release schedules a grace timer whose callback rechecks ownership before resetting the generation.
 * @evidence contracts/common.md#clear-and-simple-design One counter and one pending timer represent active ownership and the between-session grace; reacquisition cancels that timer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The measured grace controls reuse cost only; it cannot replace the new pass's filesystem proof or manufacture a valid generation.
 * @evidence contracts/common.md#meaningful-documentation Separate paragraphs explain the repeated-host compile cost, memory-only retained generation, and proof required by a reacquiring session.
 * @evidence contracts/performance.md#efficient-algorithms Acquisition and release update one counter and timer in constant time; only the final idle grace resets the generations.
 * @evidence contracts/performance.md#reuse-equivalent-work Adjacent compiler sessions share the cache through teardown gaps; a new pass still proves input equivalence before serving output.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Reacquisition cancels cleanup; one unreferenced timer clears retained generations after the final owner remains idle for the grace.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Performs no filesystem, path or process operation of its own.
 */
export function createTransformCacheLease(
  cache: TtscTransformCache,
  registry?: { acquire(): void; idle(): void },
): TtscTransformCacheLease {
  let owners = 0;
  let pending: NodeJS.Timeout | undefined;
  return {
    acquire() {
      registry?.acquire();
      owners += 1;
      if (pending !== undefined) {
        clearTimeout(pending);
        pending = undefined;
      }
    },
    release() {
      owners = Math.max(0, owners - 1);
      if (owners !== 0 || pending !== undefined) return;
      pending = setTimeout(() => {
        pending = undefined;
        if (owners === 0) {
          resetTtscTransformCache(cache);
          registry?.idle();
        }
      }, RELEASE_GRACE_MS);
      pending.unref();
    },
  };
}
