/** Common request shape for fountain verbs that act on an existing snapshot. */
export interface ITtscSnapshotHandle {
  /** Opaque handle returned by `snapshot`. */
  handle: string;
}
