/** Payload inside `ITtscResult.result` for `releaseSnapshot`. */
export interface ITtscReleaseSnapshotResult {
  /** `false` when the handle was not present (already released). */
  released: boolean;
}
