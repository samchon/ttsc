/**
 * What the Linux watch helper tells one directory subscription
 * (samchon/ttsc#1426).
 */
export interface LinuxWatchHelperSubscription {
  /**
   * The helper answered the subscription: `true` once the watch is live, and
   * `false` when the directory could not be watched.
   */
  ready(live: boolean): void;
  /**
   * One event of the directory, or `null` for the name when events were
   * dropped, which may concern anything the subscription covers.
   */
  event(eventType: string, filename: string | null): void;
  /**
   * The subscription ended without being removed: the directory went away, or
   * the helper did. Nothing more is reported for it.
   */
  end(): void;
}
