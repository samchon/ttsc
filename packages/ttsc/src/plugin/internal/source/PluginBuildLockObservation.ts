import type { PluginBuildLockFence } from "./PluginBuildLockFence";

/**
 * One observation of a plugin build lock directory's state.
 *
 * - `active`: the lock exists and its owner is alive (or cannot be disproven:
 *   another host or unconfirmed owner metadata). Keep waiting within the
 *   caller's admission budget.
 * - `abandoned`: the lock has a qualified, provably absent same-host owner. The
 *   returned fence permits an attempt to retire that observed generation.
 * - `released`: the observed generation no longer exists. In v3 the persistent
 *   coordination root remains while `current` is absent. This is a routine
 *   handoff, never an infinitely old abandoned lock (issue #421).
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
