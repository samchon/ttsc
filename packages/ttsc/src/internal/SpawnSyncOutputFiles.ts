/**
 * The files a synchronous child's standard output and error are captured into.
 *
 * {@link spawnSyncResilient} needs them to retry a spawn that failed with
 * `EBADF` because the parent held too many descriptors: the retry runs through
 * a broker process that opens these same files on low descriptors, so the
 * caller reads the output from one place whichever path produced it.
 */
export interface SpawnSyncOutputFiles {
  /** File receiving the child's standard error. */
  stderr: string;

  /** File receiving the child's standard output. */
  stdout: string;
}
