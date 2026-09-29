/**
 * One project-walk observation that could not prove a coherent snapshot.
 *
 * @evidence contracts/common.md#principled-implementation A closed failure-kind union distinguishes metadata, enumeration and read failures while the lexical path names the exact observation that failed.
 * @evidence contracts/common.md#clear-and-simple-design The value contains only the failed observation's kind and address; retry and generation decisions remain with the consuming proof owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failure kinds are structured observation outcomes rather than inferred message fragments or synthetic missing-file success.
 * @evidence contracts/common.md#meaningful-documentation Field comments explain the observation categories and specify lexical absolute spelling, preserving the distinction from resolved identity.
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
