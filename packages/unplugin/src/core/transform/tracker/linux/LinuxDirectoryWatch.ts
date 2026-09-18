/** One shared non-recursive directory watch and the observers subscribed to it. */
export interface LinuxDirectoryWatch {
  /** Release the native handle once no subscriber is left. */
  close(): void;
  /** Subscribers, each told every event with the entry name it named. */
  listeners: Set<(eventType: string, filename: string | null) => void>;
  /** Subscribers told when the handle errors, which ends the watch for all. */
  errors: Set<() => void>;
}
