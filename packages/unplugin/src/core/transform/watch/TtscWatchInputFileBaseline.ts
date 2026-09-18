/** Main-process file predicate used only by project discovery. */
export interface TtscWatchInputFileBaseline {
  /** Whether the compiler's stat classifies the path as a regular file. */
  fileExists: boolean;
  /**
   * Filesystem identity key of the path; evidence recorded for another identity
   * never matches.
   */
  identity: string;
}
