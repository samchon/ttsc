/**
 * Stat-like object returned by `stat`, `lstat`, and `fstat`.
 *
 * Mirrors the subset of `fs.Stats` that `wasm_exec.js` reads. Fields not
 * relevant to Go's `os.FileInfo` (e.g. ownership) are zeroed.
 */
export interface IFileStats {
  isDirectory(): boolean;
  isFile(): boolean;
  size: number;
  mode: number;
  mtimeMs: number;
  atimeMs: number;
  ctimeMs: number;
  dev: number;
  ino: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  blksize: number;
  blocks: number;
}
