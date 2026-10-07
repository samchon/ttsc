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
 * project again. The cache can retain generation data and clock probes;
 * generation capture decides whether notification handles are retained. When
 * the last session releases it, the lease keeps it for a short grace. A session
 * acquired within that grace opens its own delivery pass, and the pass's first
 * delivery proves the kept generation against the filesystem. The grace
 * callback resets a cache still unowned when it runs; event-loop scheduling is
 * not a wall-clock cleanup deadline. Optional registry hooks observe
 * acquisition and final idle reclamation; they do not change the generation's
 * validation or the lease's owner count.
 *
 * @evidence contracts/common.md#principled-implementation Active-session counting prevents premature reset, and final release schedules a grace timer whose callback rechecks ownership before resetting the generation.
 * @evidence contracts/common.md#clear-and-simple-design One counter and one pending timer represent active ownership and the between-session grace; reacquisition cancels that timer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The measured grace controls reuse cost only; it cannot replace the new pass's filesystem proof or manufacture a valid generation.
 * @evidence contracts/common.md#meaningful-documentation Separate paragraphs explain repeated-host compile cost, retained generation/probe responsibility and proof required by a reacquiring session, without promising a timer execution deadline.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Acquisition/release update one counter and pending timer without scanning
 *   entries. Registry hooks add their caller-owned work. Final idle callback
 *   resets N cached promises, with O(N) snapshot/cleanup scheduling and delegated
 *   generation watcher/probe disposal as fulfilled promises settle.
 * @evidence contracts/performance.md#reuse-equivalent-work Adjacent compiler sessions share the cache through teardown gaps; a new pass still proves input equivalence before serving output.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   One pending timer captures the cache/registry, is cancelled on reacquisition
 *   and is unreferenced so it does not keep the process alive. Final idle reset
 *   clears membership and schedules fulfilled generation cleanup; unresolved
 *   compiles still have no lease cancellation deadline. Cache entries/bytes
 *   are not capacity-bounded here, and callback delay can extend retention.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   The standard Node timer controls ownership grace, while generation disposal
 *   closes supplied native notification capabilities and owned clock probes.
 *   Scheduling adds no filesystem or OS-name reliability assumption, and the
 *   lease does not reinterpret the generation's actual observing view.
 */
export function createTransformCacheLease(
  /** Cache retained across sessions and reset by final idle reclamation. */
  cache: TtscTransformCache,
  /** Optional registration hooks; their failures/work remain caller-owned. */
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
