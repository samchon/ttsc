/** Main-process file predicate used only by project discovery. */
export interface TtscWatchInputFileBaseline {
  /**
   * Whether the path counts as a file under the predicate that captured it:
   * discovery's regular-file check for a file baseline, or the compiler's stat
   * kind, which counts anything but a directory, for a broad one.
   */
  fileExists: boolean;
  /**
   * Filesystem identity key of the path; evidence recorded for another identity
   * never matches.
   */
  identity: string;
}
