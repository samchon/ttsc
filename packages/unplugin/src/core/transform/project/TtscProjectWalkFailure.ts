/** One project-walk observation that could not prove a coherent snapshot. */
export interface TtscProjectWalkFailure {
  /**
   * How the observation failed: unreadable or changing metadata, a failed
   * listing, or a file that failed or moved during its read.
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
