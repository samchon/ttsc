import type { DependencyBuildLockFence } from "./DependencyBuildLockFence";

/** One observation of a dependency build lock's state. */
export type DependencyBuildLockObservation =
  | { state: "active"; owner: string; fence: DependencyBuildLockFence }
  | { state: "abandoned"; reason: string; fence: DependencyBuildLockFence }
  | { state: "released" };
