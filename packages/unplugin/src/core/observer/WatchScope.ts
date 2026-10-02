import type { InputEntry } from "./InputEntry";

/**
 * One native recursive observer and the input entries it covers.
 *
 * The project root scope is pinned for the observer's lifetime. External scopes
 * are bounded in number and close when their last entry leaves. `startedAt` is
 * the change sequence at which the observer became live, so a registration can
 * tell whether a change could have happened before its scope was watching.
 *
 * @evidence contracts/common.md#principled-implementation Scope root, start sequence, capability failure, and covered entries describe the observation authority registration can actually rely on.
 * @evidence contracts/common.md#clear-and-simple-design One scope owns its native handle while shared entries own conditions; external root identity supports topology checking without duplicating each input's watch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed or newly opened scope cannot certify a prior compile's unchanged inputs solely because a handle exists.
 * @evidence contracts/common.md#meaningful-documentation Member comments explain pinned ownership, directory admission, external root identity, and the optional directory-backend track capability.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   WatchScope only declares a shape; it has no filesystem, path or process
 *   operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   WatchScope only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   WatchScope only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   WatchScope only declares a shape; it has no handle or retained state at
 *   runtime.
 */
export interface WatchScope {
  /**
   * Keys of the covered paths below `root` and the directories leading to them,
   * the only ones a directory-level backend watches, each while it is a
   * directory (samchon/ttsc#1389). Counts represent active input contributors;
   * the last contributor removes the key and the backend can prune its watch.
   */
  directories: Map<string, number>;

  /** Entries this observer covers; an unpinned scope closes when it empties. */
  entries: Set<InputEntry>;

  /**
   * Whether the observer failed to open or errored, moving its entries to the
   * poll.
   */
  failed: boolean;

  /** Directory observed recursively. */
  root: string;

  /**
   * The device and file id `root` resolved to when an external observer opened,
   * re-checked by the bounded poll. A replaced root leaves an inotify or
   * FSEvents observer watching the old directory, so a mismatch fails the scope
   * and hands its entries to the poll (samchon/ttsc#1384).
   */
  identity?: string;

  /**
   * Whether the scope lives for the observer's lifetime, as the project root
   * does.
   */
  pinned: boolean;

  /** Change sequence at which the observer became live. */
  startedAt: number;

  /**
   * The native handle, absent once failed or closed. `track` exists only on a
   * directory-level backend.
   */
  watcher?: {
    close(): void;
    track?(file: string, subtree?: boolean): void;
    prune?(): void;
  };
}
