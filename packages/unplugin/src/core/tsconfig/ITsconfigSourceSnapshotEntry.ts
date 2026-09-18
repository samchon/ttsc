/** One config-chain input captured for generation-state comparison. */
export interface ITsconfigSourceSnapshotEntry {
  /** Exact bytes decoded as UTF-8, or `null` when a probed config is absent. */
  contents: string | null;
  /** Canonical absolute spelling when the input exists. */
  path: string;
}
