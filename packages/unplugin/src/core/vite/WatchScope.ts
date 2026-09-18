import type { InputEntry } from "./InputEntry";

/**
 * One native recursive observer and the input entries it covers.
 *
 * The project root scope is pinned for the server's lifetime. External scopes
 * are bounded in number and close when their last entry leaves. `startedAt` is
 * the change sequence at which the observer became live, so a registration can
 * tell whether a change could have happened before its scope was watching.
 */
export interface WatchScope {
  /**
   * Keys of the covered paths below `root` and the directories leading to them,
   * the only ones a directory-level backend watches, each while it is a
   * directory (samchon/ttsc#1389). A key outlives the entry that added it, so a
   * pinned scope keeps watching a directory an input once needed until that
   * directory disappears.
   */
  directories: Set<string>;
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
   * Whether the scope lives for the server's lifetime, as the project root
   * does.
   */
  pinned: boolean;
  /** Change sequence at which the observer became live. */
  startedAt: number;
  /**
   * The native handle, absent once failed or closed. `track` exists only on a
   * directory-level backend.
   */
  watcher?: { close(): void; track?(file: string): void };
}
