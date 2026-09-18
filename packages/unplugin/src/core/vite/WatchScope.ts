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
  entries: Set<InputEntry>;
  failed: boolean;
  root: string;
  pinned: boolean;
  startedAt: number;
  watcher?: { close(): void };
}
