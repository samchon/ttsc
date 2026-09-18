/** One project-walk hash set together with its completeness proof. */
export interface TtscProjectInputHashSnapshot {
  /**
   * Whether every attempted directory and file was observed coherently;
   * cache-key hosts must reject an incomplete set.
   */
  complete: boolean;
  /** SHA-256 of every walked input, keyed by project-relative slash path. */
  hashes: Record<string, string>;
}
