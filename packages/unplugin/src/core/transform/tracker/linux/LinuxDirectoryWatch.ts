import type { LinuxWatchHelper } from "./LinuxWatchHelper";

/** One shared non-recursive directory watch and the observers subscribed to it. */
export interface LinuxDirectoryWatch {
  /** Release the helper's subscription once no subscriber is left. */
  close(): void;
  /** The helper serving the watch, which a joining subscriber syncs with. */
  helper: LinuxWatchHelper;
  /** Subscribers, each told every event with the entry name it named. */
  listeners: Set<(eventType: string, filename: string | null) => void>;
  /**
   * Subscribers told when the watch ends: its directory went away, it could not
   * be opened, or the helper serving it exited. It ends for all of them.
   */
  errors: Set<() => void>;
  /**
   * Whether the watch is live, once the helper has answered
   * (samchon/ttsc#1426). Nothing is heard before it resolves `true`.
   */
  ready: Promise<boolean>;
}
