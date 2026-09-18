import type { TtscWatchInputKind } from "../transform/watch/TtscWatchInputKind";

/**
 * The watch input kinds a watching session sends through its bridge, by what
 * the host's own channels were measured to observe (samchon/ttsc#1388).
 *
 * Every set carries the project's root-file membership (samchon/ttsc#1419). No
 * host channel observes it precisely: a directory channel is recursive or
 * absent, and the bridge re-walks the project under the transform's own rule
 * instead.
 */
export const BRIDGED_WATCH_INPUT_KINDS: {
  /**
   * A host with typed channels whose directory channel is recursive: webpack,
   * Rspack, and Turbopack. On the project root, which the compiler lists, it
   * reacts to every write, output included, so listings and membership are
   * bridged.
   */
  readonly recursiveDirectoryChannel: ReadonlySet<TtscWatchInputKind>;
  /**
   * A host whose one channel observes only existing files: Rolldown and Farm.
   * Missing paths, listings, and membership are bridged.
   */
  readonly fileChannel: ReadonlySet<TtscWatchInputKind>;
  /**
   * A host that opens one watcher per registered path, recursively for a
   * directory: Rollup. Everything is bridged.
   */
  readonly watcherPerPath: ReadonlySet<TtscWatchInputKind>;
} = {
  fileChannel: new Set(["listing", "membership", "missing"]),
  recursiveDirectoryChannel: new Set(["listing", "membership"]),
  watcherPerPath: new Set(["file", "listing", "membership", "missing"]),
};
