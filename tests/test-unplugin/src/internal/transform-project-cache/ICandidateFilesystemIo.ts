/** Counts of cache filesystem calls against the first speculative candidate. */
export interface ICandidateFilesystemIo {
  /** `readFile` calls on the candidate. */
  readFile: number;
  /** `realpath` calls on the candidate. */
  realpath: number;
  /** `stat` calls on the candidate. */
  stat: number;
}
