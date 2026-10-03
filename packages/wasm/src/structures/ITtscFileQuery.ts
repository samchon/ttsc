import type { ITtscSnapshotHandle } from "./ITtscSnapshotHandle";

/**
 * Request shape for `getSourceFileText`.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Extending the shared handle keeps snapshot identity consistent while adding
 *   the file selector accepted by resolveSnapshotFile in the native host.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Extending the common handle adds only the file selector, so all file queries
 *   share one snapshot identity definition and path interpretation boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   The request names its snapshot and file explicitly; no project lookup is
 *   replaced by a fixed consumer path.
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc names the endpoint and accepted path bases, while the inherited member
 *   documents the opaque handle, following the documentation skill's context rule.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscFileQuery is a data interface and acquires no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscFileQuery is a data interface and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscFileQuery is a data interface and coordinates no shared or repeated computation.
 */
export interface ITtscFileQuery extends ITtscSnapshotHandle {
  /** Project-relative or absolute path inside the snapshot's program. */
  path: string;
}
