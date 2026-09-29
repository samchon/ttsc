/**
 * Stat-like object returned by `stat`, `lstat`, and `fstat`.
 *
 * Mirrors the subset of `fs.Stats` that `wasm_exec.js` reads. Fields not
 * relevant to Go's `os.FileInfo` (e.g. ownership) are zeroed.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Node-shaped fields and kind predicates match the Go js/wasm bridge's stats
 *   consumer; this is a virtual projection rather than a native inode model.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One stats snapshot groups sampled kind, byte size and projected metadata;
 *   predicates expose the two supported kinds without another node hierarchy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Synthetic device/ownership values express MemFS capabilities, without
 *   presenting browser-host metadata as actual operating-system file identity.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native JSDoc explains bridge scope, time and size units and synthetic fields,
 *   following the documentation skill's concrete context guidance.
 */
export interface IFileStats {
  /**
   * Whether the sampled node is a virtual directory.
   *
   * @evidence contracts/common.md#principled-implementation makeStats captures node.kind once, so the predicate reports that sampled directory classification.
   * @evidence contracts/common.md#clear-and-simple-design The kind query is separate from metadata fields and shares the captured classification with isFile.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts It reports the sampled node kind, not a filename heuristic.
   * @evidence contracts/common.md#meaningful-documentation JSDoc names snapshot provenance under the documentation skill's context rule.
   */
  isDirectory(): boolean;

  /**
   * Whether the sampled node is a virtual regular file.
   *
   * @evidence contracts/common.md#principled-implementation MemFS has only file and directory nodes, making the inverse sampled-directory flag its regular-file classification.
   * @evidence contracts/common.md#clear-and-simple-design The predicate exposes the other supported node kind through the same snapshot rather than recalculating a path.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The virtual node kind determines the result, without extension special cases.
   * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes regular-file classification under the documentation skill's clarity rule.
   */
  isFile(): boolean;

  /** File byte length; zero for a directory. */
  size: number;

  /** Virtual file-kind and permission bits, in Node stat format. */
  mode: number;

  /** Modification time in milliseconds since the Unix epoch. */
  mtimeMs: number;

  /** Access-time projection; MemFS uses its modification timestamp. */
  atimeMs: number;

  /** Change-time projection; MemFS uses its modification timestamp. */
  ctimeMs: number;

  /** Synthetic device identity; MemFS uses zero. */
  dev: number;

  /** Synthetic inode identity; MemFS uses zero. */
  ino: number;

  /** Synthetic link count; MemFS uses one. */
  nlink: number;

  /** Synthetic owner id; MemFS uses zero. */
  uid: number;

  /** Synthetic group id; MemFS uses zero. */
  gid: number;

  /** Synthetic special-device identity; MemFS uses zero. */
  rdev: number;

  /** Virtual preferred I/O block size in bytes. */
  blksize: number;

  /** Allocated-size projection measured in 512-byte blocks. */
  blocks: number;
}
