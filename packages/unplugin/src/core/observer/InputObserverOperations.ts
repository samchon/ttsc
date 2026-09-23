/**
 * The native operations an input observer (`createInputObserver`) uses,
 * replaceable for tests.
 *
 * `watch` opens one recursive observer and `poll` opens the shared fallback
 * timer. The optional overrides let a test simulate another platform's path and
 * case semantics without touching the host filesystem.
 */
export interface InputObserverOperations {
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
   * recursive backend needs neither (samchon/ttsc#1389). With `subtree`,
   * `track` also watches every directory below the path that `admit` now
   * accepts, since a project's root-file membership widens it there
   * (samchon/ttsc#1419). `probeRoot` is the project root when the scope is the
   * project's, where a brokered backend may prove its stream delivered through
   * a probe below the project's tool cache (samchon/ttsc#1453).
   */
  watch(
    root: string,
    listener: (eventType: string, file: string | null) => void,
    onError: () => void,
    admit?: (directory: string) => boolean,
    probeRoot?: string,
  ): { close(): void; track?(file: string, subtree?: boolean): void };
}
