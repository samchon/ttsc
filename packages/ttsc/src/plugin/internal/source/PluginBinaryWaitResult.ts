import type { PluginBuildLockFence } from "./PluginBuildLockFence";

/**
 * Outcome of one waiting session on another process's plugin build lock.
 *
 * - `published`: the binary pathname was observed to exist; the caller owns
 *   cache-key trust and reader admission before reuse, not this existence
 *   test.
 * - `released`: the inspector supplied a released handoff and the following
 *   binary existence check was false. Retry ordinary acquisition without
 *   reporting or removing a holder; a successor may already have appeared.
 * - `abandoned`: the inspector supplied an abandoned-owner observation; the
 *   caller may report and retire precisely the attached generation.
 *
 * The fence permits retirement only of the generation this wait observed;
 * wait-budget expiry throws without returning a retirement capability.
 *
 * @evidence contracts/common.md#principled-implementation The discriminated union distinguishes published reuse, ordinary reacquisition and fenced retirement; only retirement carries the reason and exact observed-generation capability.
 * @evidence contracts/common.md#clear-and-simple-design Three outcomes expose the caller's next action without optional reason/fence fields on unrelated states.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Elapsed time never supplies an abandoned result; a bounded-wait failure leaves the potentially active task's ownership intact.
 * @evidence contracts/common.md#meaningful-documentation Native bullets explain acquisition/retirement consequences and distinguish timeout failure from a returned abandonment capability, with blank separation before tags.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
 */
export type PluginBinaryWaitResult =
  | { outcome: "published" }
  | { outcome: "released" }
  | {
      outcome: "abandoned";
      reason: string;
      fence: PluginBuildLockFence;
    };
