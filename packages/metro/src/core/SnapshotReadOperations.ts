/**
 * The filesystem reads the snapshot reader performs, injectable so a test can
 * drive the interleaving of a listing with a concurrent compaction. Production
 * passes nothing and reads the real filesystem.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A structural record of the three Node filesystem reads the snapshot reader
 *   makes; the default delegates to node:fs unchanged.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   One optional parameter carries the read boundary instead of a test mode
 *   flag, mirroring the repository's injectable filesystem operations.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Production code never branches on the injection; no fs method is patched.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   The native JSDoc states why the boundary exists and that production uses
 *   the real filesystem.
 */
export interface SnapshotReadOperations {
  /**
   * Whether a path exists, as `fs.existsSync`.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Signature of the Node call it replaces; the default delegates to it.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   One call per member, no behavior of its own.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The reader never branches on whether it was injected.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   States which read this member stands for.
   */
  existsSync: (file: string) => boolean;

  /**
   * Text of a file, as `fs.readFileSync`; throws a missing-file error when absent.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Signature of the Node call it replaces; the default delegates to it.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   One call per member, no behavior of its own.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The reader never branches on whether it was injected.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   States which read this member stands for.
   */
  readFileSync: (file: string, encoding: "utf8") => string;

  /**
   * Entry names of a directory, as `fs.readdirSync`.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Signature of the Node call it replaces; the default delegates to it.
   *
   * @evidence contracts/common.md#clear-and-simple-design
   *   One call per member, no behavior of its own.
   *
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   The reader never branches on whether it was injected.
   *
   * @evidence contracts/common.md#meaningful-documentation
   *   States which read this member stands for.
   */
  readdirSync: (directory: string) => string[];
}
