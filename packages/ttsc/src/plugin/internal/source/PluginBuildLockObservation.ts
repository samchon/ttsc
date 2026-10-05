import type { PluginBuildLockFence } from "./PluginBuildLockFence";

/**
 * One observation of a plugin build lock directory's state.
 *
 * - `active`: the lock exists and its owner is alive (or cannot be disproven:
 *   another host or unconfirmed owner metadata). Keep waiting within the
 *   caller's admission budget.
 * - `abandoned`: the lock has a qualified, provably absent same-host owner. The
 *   returned fence permits an attempt to retire that observed generation.
 * - `released`: observation found a released or unavailable handoff and carries
 *   no fence. V3 coordination roots persist independently of `current`; these
 *   sequential observations do not guarantee that no successor exists by
 *   return. This is never an infinitely old abandoned lock.
 *
 * A v3 active or abandoned result records the observer before returning its
 * fence. Reclamation is still a separate action that may lose a retirement
 * race.
 *
 * @evidence contracts/common.md#principled-implementation The discriminated union requires a fence for occupied generations and omits it for absence, separating liveness labels from retirement authority.
 * @evidence contracts/common.md#clear-and-simple-design Each state carries only its relevant diagnostic description and token; observation does not itself retire ownership.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Released is represented explicitly rather than an infinite age that could manufacture abandonment after a normal handoff.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains all three states, persistent-root absence and the observation/reclamation distinction before its tags.
 * @evidence contracts/portability.md#os-neutral-implementation The states represent filesystem observations independently of OS errno wording; occupied states carry the protocol distinction needed for native retirement.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 */
export type PluginBuildLockObservation =
  | {
      state: "active";

      /** The diagnostic label of the observed holder. */
      owner: string;

      /** The captured identity; a timeout alone cannot authorize retirement. */
      fence: PluginBuildLockFence;
    }
  | {
      state: "abandoned";

      /** The qualified process-absence grounds for reclamation. */
      reason: string;

      /** The generation whose retirement may be attempted. */
      fence: PluginBuildLockFence;
    }
  | { state: "released" };
