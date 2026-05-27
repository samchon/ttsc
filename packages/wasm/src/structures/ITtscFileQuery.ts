import type { ITtscSnapshotHandle } from "./ITtscSnapshotHandle";

/** Request shape for `getSourceFileText`. */
export interface ITtscFileQuery extends ITtscSnapshotHandle {
  /** Project-relative or absolute path inside the snapshot's program. */
  path: string;
}
