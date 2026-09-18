/**
 * Opaque identity of one observed lock generation.
 *
 * Returned by {@link inspectPluginBuildLock} and consumed by
 * {@link reclaimPluginBuildLock}, so a waiter retires exactly the generation it
 * judged abandoned, under the protocol it observed, and never a successor.
 */
export type PluginBuildLockFence = {
  /** Which lock protocol held the observed generation. */
  protocol: "legacy" | "v2";
  /** The 128-bit hex id of the observed generation. */
  generation: string;
};
