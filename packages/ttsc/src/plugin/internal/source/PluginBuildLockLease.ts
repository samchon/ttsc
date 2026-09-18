/**
 * Ownership token returned only to the process that acquired the v2 lock.
 *
 * Produced by {@link acquirePluginBuildLock} and consumed by
 * {@link releasePluginBuildLock}. Release retires this generation and no other,
 * so a holder whose lock was reclaimed cannot release its successor.
 */
export type PluginBuildLockLease = {
  /** Always `"v2"`: new holders only ever acquire the current protocol. */
  protocol: "v2";
  /** The 128-bit hex id of the held generation. */
  generation: string;
};
