import type { PluginBuildLockFence } from "./PluginBuildLockFence";

/**
 * One observation of a plugin build lock directory's state.
 *
 * - `active`: the lock exists and its owner is alive (or cannot be disproven:
 *   another host, no metadata but young). Keep waiting.
 * - `abandoned`: the lock still exists and the evidence says nobody will ever
 *   release it — a same-host owner that is no longer running, or an old
 *   metadata-less legacy lock. Retiring its fenced generation is justified.
 * - `released`: the observed generation no longer exists. In v2 the persistent
 *   coordination root remains while `current` is absent. This is a routine
 *   handoff, never an infinitely old abandoned lock (issue #421).
 *
 * Exported for unit tests.
 */
export type PluginBuildLockObservation =
  | {
      state: "active";
      owner: string;
      fence: PluginBuildLockFence;
    }
  | {
      state: "abandoned";
      reason: string;
      fence: PluginBuildLockFence;
    }
  | { state: "released" };
