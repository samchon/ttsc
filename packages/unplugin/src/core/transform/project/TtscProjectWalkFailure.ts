/**
 * One project-walk observation that could not prove a coherent snapshot.
 *
 * @evidence contracts/common.md#principled-implementation A closed failure-kind union distinguishes metadata, enumeration and read failures while the lexical path names the exact observation that failed.
 * @evidence contracts/common.md#clear-and-simple-design The value contains only the failed observation's kind and address; retry and generation decisions remain with the consuming proof owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure kinds are structured observation outcomes rather than inferred message fragments or synthetic missing-file success.
 * @evidence contracts/common.md#meaningful-documentation Field comments explain the observation categories and specify lexical absolute spelling, preserving the distinction from resolved identity.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   TtscProjectWalkFailure only declares a shape; it has no filesystem, path
 *   or process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   TtscProjectWalkFailure only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   TtscProjectWalkFailure only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   TtscProjectWalkFailure only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface TtscProjectWalkFailure {
  /**
   * How the observation failed: unreadable or changing metadata, a failed
   * listing, or a file that failed or changed during its read.
   */
  kind:
    | "directory-changed-during-walk"
    | "directory-metadata-unavailable"
    | "directory-read-failed"
    | "file-changed-during-read"
    | "file-read-failed";

  /** Absolute lexical spelling observed by the walk. */
  path: string;
}
