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
   * Whether the scope lives for the server's lifetime, as the project root
   * does.
   */
  pinned: boolean;
  /** Change sequence at which the observer became live. */
  startedAt: number;
  /** The native handle, absent once failed or closed. */
  watcher?: { close(): void };
}
