import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";

/**
 * One observation of a dependency build lock's state.
 *
 * Active and abandoned states carry a generation fence; only abandoned gives
 * grounds for recovery. Released means no generation could be observed, not
 * that the observer acquired the lock.
 *
 * @evidence contracts/common.md#principled-implementation A discriminated union separates active ownership, abandoned recovery grounds and released absence; fences belong only to observations of a holder and do not imply acquisition.
 * @evidence contracts/common.md#clear-and-simple-design Each state carries its own diagnostic information, avoiding optional owner and reason fields with ambiguous combinations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation preserves observation uncertainty and does not turn absence or a timeout label into a successful lease.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the fence, recovery permission and released-versus-acquired distinction in readable separated prose.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type DependencyBuildLockObservation =
  | {
      /** Held or uncertain ownership that must not be reclaimed yet. */
      state: "active";

      /** Human-readable holder or uncertainty description for wait diagnostics. */
      owner: string;

      /** Observed generation; unreadable identity uses the empty sentinel. */
      fence: DependencyBuildLockFence;
    }
  | {
      /** Recoverable generation, still subject to its retirement fence. */
      state: "abandoned";

      /** Evidence that permitted recovery, such as a gone local owner. */
      reason: string;

      /** Exact historical generation recovery may attempt to retire. */
      fence: DependencyBuildLockFence;
    }
  | {
      /** No held generation was observed; acquisition is still a separate step. */
      state: "released";
    };
