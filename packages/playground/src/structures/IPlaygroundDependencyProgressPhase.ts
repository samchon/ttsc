/** Lifecycle phase of a single dependency install reported via the progress callback. */
export type IPlaygroundDependencyProgressPhase =
  | "queued"
  | "resolve"
  | "download"
  | "extract"
  | "skip"
  | "error"
  | "done";
