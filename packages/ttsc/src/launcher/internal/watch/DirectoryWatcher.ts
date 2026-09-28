/**
 * A watch on one directory, as `watchDirectory` opens it on every platform.
 *
 * It carries what the watch set needs from `fs.FSWatcher` and nothing else, so
 * a backend other than `fs.watch` can serve it: closing it, and hearing that it
 * failed.
 */
export interface DirectoryWatcher {
  /** Stop delivering events. Closing a watch twice is harmless. */
  close(): void;

  /** Hear the watch fail; it delivers nothing afterwards. */
  on(event: "error", listener: (error: Error) => void): unknown;
}
