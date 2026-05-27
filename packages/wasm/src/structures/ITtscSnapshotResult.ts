/** Payload inside `ITtscResult.result` for `snapshot`. */
export interface ITtscSnapshotResult {
  /** Opaque handle; pass back to fountain verbs and to `releaseSnapshot`. */
  handle: string;
}
