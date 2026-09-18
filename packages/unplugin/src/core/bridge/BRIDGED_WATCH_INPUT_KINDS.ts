import type { TtscWatchInputKind } from "../transform/watch/TtscWatchInputKind";

/**
 * The watch input kinds a watching session sends through its bridge, by what
 * the host's own channels were measured to observe (samchon/ttsc#1388).
 */
export const BRIDGED_WATCH_INPUT_KINDS: {
  /**
   * A host with typed channels whose directory channel is recursive: webpack,
   * Rspack, and Turbopack. On the project root, which the compiler lists, it
   * reacts to every write, output included, so listings are bridged.
   */
  readonly recursiveDirectoryChannel: ReadonlySet<TtscWatchInputKind>;
  /**
   * A host whose one channel observes only existing files: Rolldown and Farm.
   * Missing paths and listings are bridged.
   */
  readonly fileChannel: ReadonlySet<TtscWatchInputKind>;
  /**
   * A host that opens one watcher per registered path, recursively for a
   * directory: Rollup. Everything is bridged.
   */
  readonly watcherPerPath: ReadonlySet<TtscWatchInputKind>;
} = {
  fileChannel: new Set(["listing", "missing"]),
  recursiveDirectoryChannel: new Set(["listing"]),
  watcherPerPath: new Set(["file", "listing", "missing"]),
};
