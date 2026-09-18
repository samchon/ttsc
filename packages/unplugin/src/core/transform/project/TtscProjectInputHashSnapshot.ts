/** One project-walk hash set together with its completeness proof. */
export interface TtscProjectInputHashSnapshot {
  complete: boolean;
  hashes: Record<string, string>;
}
