import type { PluginBuildLockFence } from "./PluginBuildLockFence";

/**
 * Outcome of one waiting session on another process's plugin build lock.
 *
 * - `published`: the binary exists and can be reused.
 * - `released`: the observed generation no longer exists and no binary appeared —
 *   the holder freed the key normally, so the caller should retry ordinary
 *   acquisition without reporting or removing anything.
 * - `abandoned`: the lock still exists but is provably stale (dead owner, old
 *   legacy lock) or the wait budget expired; the caller may report and retire
 *   precisely the attached generation.
 *
 * Exported for unit tests.
 */
export type PluginBinaryWaitResult =
  | { outcome: "published" }
  | { outcome: "released" }
  | {
      outcome: "abandoned";
      reason: string;
      fence: PluginBuildLockFence;
    };
