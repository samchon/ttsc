/**
 * The native operations an input observer (`createInputObserver`) uses,
 * replaceable for tests.
 *
 * `watch` opens one recursive observer and `poll` opens the shared fallback
 * timer. The optional overrides let a test simulate another platform's path and
 * case semantics without touching the host filesystem.
 *
 * @evidence contracts/common.md#principled-implementation Watch, poll, platform, and directory-case capabilities describe the observer's native boundary without changing unrelated hosts' operations.
 * @evidence contracts/common.md#clear-and-simple-design A structural operation table exposes observation capabilities; input evidence and consumer actions remain outside the seam.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit injected capabilities avoid foreign-method replacement, with production defaults independent of test-specific paths.
 * @evidence contracts/common.md#meaningful-documentation Method comments explain admission, tracking, and project-owned probes with their distinct backend responsibilities.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   InputObserverOperations only declares a shape; it has no filesystem, path
 *   or process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   InputObserverOperations only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   InputObserverOperations only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   InputObserverOperations only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface InputObserverOperations {
  /**
   * Override case-policy discovery for a simulated host filesystem.
   *
   * @evidence contracts/common.md#principled-implementation Case policy describes the observed directory rather than being assumed from the operating-system name.
   * @evidence contracts/common.md#clear-and-simple-design One optional query supplies the existing path-identity resolver's capability.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Injection declares behavior without globally lowercasing paths or patching native reads.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies directory case discovery as the override's responsibility.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of caseSensitive is declared here; the platform
   *   behaviour belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of caseSensitive is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of caseSensitive is declared here; the cost belongs to
   *   its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of caseSensitive is declared here; the cost belongs to
   *   its implementation.
   */
  caseSensitive?(directory: string): boolean;

  /** Override path semantics when testing a non-host platform. */
  platform?: NodeJS.Platform;

  /**
   * Open the shared fallback timer.
   *
   * @evidence contracts/common.md#principled-implementation The returned handle owns one scheduler for conditions native scopes cannot prove.
   * @evidence contracts/common.md#clear-and-simple-design Listener and close expose scheduling only; input sampling remains in the observer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The scheduler invokes actual checks without synthetic results or global timer replacement.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies shared timing and the return type exposes its close handle.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of poll is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of poll is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of poll is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of poll is declared here; the cost belongs to its
   *   implementation.
   */
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
   *
   * @evidence contracts/common.md#principled-implementation Events, failure, admission, and optional project probes distinguish actual native coverage from a handle whose authority is unproven.
   * @evidence contracts/common.md#clear-and-simple-design The handle exposes closure and optional directory tracking; recursive backends need not implement redundant tracking.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Project probes cannot write into external scopes or replace real event-delivery proof with construction success.
   * @evidence contracts/common.md#meaningful-documentation The preceding native comment explains admission, subtree tracking, and project-only probe ownership.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of watch is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of watch is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of watch is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of watch is declared here; the cost belongs to its
   *   implementation.
   */
  watch(
    root: string,
    listener: (eventType: string, file: string | null) => void,
    onError: () => void,
    admit?: (directory: string) => boolean,
    probeRoot?: string,
  ): {
    close(): void;
    track?(file: string, subtree?: boolean): void;
    prune?(): void;
  };
}
