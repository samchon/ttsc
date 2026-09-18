/**
 * The native operations the Vite serve watcher uses, replaceable for tests.
 *
 * `watch` opens one recursive observer and `poll` opens the shared fallback
 * timer. The optional overrides let a test simulate another platform's path and
 * case semantics without touching the host filesystem.
 */
export interface ViteServeWatchOperations {
  /** Override case-policy discovery for a simulated host filesystem. */
  caseSensitive?(directory: string): boolean;
  /** Override path semantics when testing a non-host platform. */
  platform?: NodeJS.Platform;
  /** Open the shared fallback timer. */
  poll(listener: () => void): { close(): void };
  /**
   * Open one recursive native observer on `root`.
   *
   * `admit` names the directories below `root` a directory-level backend must
   * watch, and `track` on the handle forces the directories leading to a newly
   * covered path, and the path itself while it is a directory; a natively
   * recursive backend needs neither (samchon/ttsc#1389).
   */
  watch(
    root: string,
    listener: (eventType: string, file: string | null) => void,
    onError: () => void,
    admit?: (directory: string) => boolean,
  ): { close(): void; track?(file: string): void };
}
