import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";

/**
 * One observation of a dependency build lock's state.
 *
 * Active and abandoned states carry a generation fence; only abandoned gives
 * grounds for recovery under the inspector's policy: a proven-gone local owner
 * or a sufficiently old generation whose owner record was unreadable or
 * invalid. The latter is not proof of process death. Released means no held
 * generation was observed, not that the observer acquired the lock; sequential
 * native reads do not constitute an atomic ownership snapshot.
 *
 * @evidence contracts/common.md#principled-implementation A discriminated union separates active or uncertain ownership, policy-selected recovery grounds and released absence; observed fences do not imply acquisition or an atomic ownership snapshot.
 * @evidence contracts/common.md#clear-and-simple-design Each state carries its own diagnostic information, avoiding optional owner and reason fields with ambiguous combinations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation preserves observation uncertainty and does not turn absence or a timeout label into a successful lease.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the fence, both recovery grounds, sequential-read uncertainty and the released-versus-acquired distinction without certifying owner liveness.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidence contracts/portability.md#os-neutral-implementation State labels represent the inspector's conservative native ownership policy; owner and reason are diagnostic text, not cross-platform pid authority. The hexadecimal or unreadable fence remains separate from native paths and liveness probes, and no member pins a filesystem namespace.
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

      /**
       * Policy-selected recovery reason; stale unreadable records do not prove
       * process death.
       */
      reason: string;

      /** Exact historical generation recovery may attempt to retire. */
      fence: DependencyBuildLockFence;
    }
  | {
      /** No held generation was observed; acquisition is still a separate step. */
      state: "released";
    };
