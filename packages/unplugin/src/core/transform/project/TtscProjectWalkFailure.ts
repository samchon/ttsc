/** One project-walk observation that could not prove a coherent snapshot. */
export interface TtscProjectWalkFailure {
  kind:
    | "directory-changed-during-walk"
    | "directory-metadata-unavailable"
    | "directory-read-failed"
    | "file-changed-during-read"
    | "file-read-failed";
  /** Absolute lexical spelling observed by the walk. */
  path: string;
}
