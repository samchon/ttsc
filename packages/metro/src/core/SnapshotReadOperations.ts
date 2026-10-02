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
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Declares a shape only; it holds no state, handle or buffer.
 *
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   Declares a shape only; there is no loop or processing in it.
 *
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Declares a shape only; it computes nothing to share.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   Declares three call signatures; the host filesystem interprets every path it is given.
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
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Declares a shape only; it holds no state, handle or buffer.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Declares a shape only; there is no loop or processing in it.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Declares a shape only; it computes nothing to share.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Forwards its path to the host call unchanged; no path is interpreted here.
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
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Declares a shape only; it holds no state, handle or buffer.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Declares a shape only; there is no loop or processing in it.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Declares a shape only; it computes nothing to share.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Forwards its path to the host call unchanged; no path is interpreted here.
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
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Declares a shape only; it holds no state, handle or buffer.
   *
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Declares a shape only; there is no loop or processing in it.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Declares a shape only; it computes nothing to share.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Forwards its directory to the host call unchanged; no path is interpreted here.
   */
  readdirSync: (directory: string) => string[];
}
