import type { ITtscSnapshotHandle } from "./ITtscSnapshotHandle";

/**
 * Request shape for `getSourceFileText`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Extending the shared handle keeps snapshot identity consistent while adding
 *   the file selector accepted by resolveSnapshotFile in the native host.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The request names its snapshot and file explicitly; no project lookup is
 *   replaced by a fixed consumer path.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the endpoint and accepted path bases, while the inherited member
 *   documents the opaque handle, following the documentation skill's context rule.
 */
export interface ITtscFileQuery extends ITtscSnapshotHandle {
  /** Project-relative or absolute path inside the snapshot's program. */
  path: string;
}
