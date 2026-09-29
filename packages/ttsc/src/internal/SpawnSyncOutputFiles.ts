/**
 * The files a synchronous child's standard output and error are captured into.
 *
 * {@link spawnSyncResilient} needs them to retry a spawn that failed with
 * `EBADF` because the parent held too many descriptors: the retry runs through
 * a broker process that opens these same files on low descriptors, so the
 * caller reads the output from one place whichever path produced it.
 *
 * The caller owns both capture files and their cleanup. These are native file
 * paths, not open descriptors or shell redirection expressions.
 *
 * @evidence contracts/common.md#principled-implementation Separate stdout and stderr paths preserve the two child streams across ordinary and low-descriptor launches; the pair denotes caller-owned capture destinations rather than ownership of live descriptors.
 * @evidence contracts/common.md#clear-and-simple-design A two-path container supplies only the output destinations needed by the broker while spawn options and capture-file lifecycle remain with their owners.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The broker writes the actual child streams into caller-selected files; the type provides no synthetic output or special-case expected command result.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain retry use, common read destinations, caller cleanup and path-versus-descriptor meaning; member and acknowledgment spacing follow the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Native output paths are passed to supported filesystem operations rather than encoded as shell redirection; the launch owner decides whether the POSIX descriptor broker is applicable.
 */
export interface SpawnSyncOutputFiles {
  /** File receiving the child's standard error. */
  stderr: string;

  /** File receiving the child's standard output. */
  stdout: string;
}
