/**
 * The native operations an input observer (`createInputObserver`) uses,
 * replaceable for tests.
 *
 * `watch` opens one recursive observer and `poll` opens the shared fallback
 * timer. The optional overrides let a test simulate another platform's path and
 * case inputs without changing global defaults. They do not replace the
 * observer's content/metadata filesystem reads; a supplied view must keep event
 * names, native corpus and comparison inputs coherent.
 *
 * @evidence contracts/common.md#principled-implementation Watch, poll, platform, and directory-case capabilities describe the observer's native boundary without changing unrelated hosts' operations.
 * @evidence contracts/common.md#clear-and-simple-design A structural operation table exposes observation capabilities; input evidence and consumer actions remain outside the seam.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit injected capabilities avoid foreign-method replacement, with production defaults independent of test-specific paths.
 * @evidence contracts/common.md#meaningful-documentation Method comments explain admission, tracking, and project-owned probes with their distinct backend responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native root/directory/event names and optional grammar/case capabilities
 *   define the observation boundary. Grammar is not a filesystem case proof;
 *   absent overrides retain native defaults and supplied views own coherence.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The table defines callable capabilities; observer/backends choose native
 *   traversal and sampling algorithms, not this representation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The table defines no completed/in-flight coordinator; observer scope and
 *   backend registries establish which operations may share coverage.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Returned close capabilities transfer handles to the observer; this table
 *   defines no independent acquisition/retention or teardown implementation.
 */
export interface InputObserverOperations {
  /**
   * Supply a directory's case comparison policy for the observer's identity
   * resolver. The provider owns the accuracy of its advertised answer.
   *
   * @evidence contracts/common.md#principled-implementation Case policy describes the observed directory rather than being assumed from the operating-system name.
   * @evidence contracts/common.md#clear-and-simple-design One optional query supplies the existing path-identity resolver's capability.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Injection declares behavior without globally lowercasing paths or patching native reads.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies directory case discovery as the override's responsibility.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   A native directory spelling selects a supplied comparison capability.
   *   The answer is independent of OS grammar and must describe that directory;
   *   supplying a boolean is not itself a measured filesystem observation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   The query signature defines directory/boolean representation; its provider
   *   and identity resolver own computation, shared facts and retained resources.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   The query signature defines directory/boolean representation; its provider
   *   and identity resolver own computation, shared facts and retained resources.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The query signature defines directory/boolean representation; its provider
   *   and identity resolver own computation, shared facts and retained resources.
   */
  caseSensitive?(directory: string): boolean;

  /** Identity-comparison path grammar override; not a replacement filesystem. */
  platform?: NodeJS.Platform;

  /**
   * Open the shared fallback timer.
   *
   * @evidence contracts/common.md#principled-implementation The returned handle owns one scheduler for conditions native scopes cannot prove.
   * @evidence contracts/common.md#clear-and-simple-design Listener and close expose scheduling only; input sampling remains in the observer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The scheduler invokes actual checks without synthetic results or global timer replacement.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies shared timing and the return type exposes its close handle.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   This scheduling callback and close capability carry no native path,
   *   file identity or process representation; sampling belongs to the observer.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   This callback/close signature defines scheduling capability; scheduler
   *   strategy, shared use and actual timer ownership stay with its implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   This callback/close signature defines scheduling capability; scheduler
   *   strategy, shared use and actual timer ownership stay with its implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   This callback/close signature defines scheduling capability; scheduler
   *   strategy, shared use and actual timer ownership stay with its implementation.
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
   * @evidence contracts/portability.md#os-neutral-implementation
   *   Root/admitted/tracked directory and optional project probe paths are
   *   native spellings. Named events are root-relative; null leaves attribution
   *   unknown and onError withdraws scope coverage. Native backend differences
   *   remain behind optional tracking/pruning rather than an OS-wide promise.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   The signature defines watch/admission/close capabilities; recursive
   *   traversal, shared subscriptions and handle lifetime are implemented by
   *   the observer and selected backend.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   The signature defines watch/admission/close capabilities; recursive
   *   traversal, shared subscriptions and handle lifetime are implemented by
   *   the observer and selected backend.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   The signature defines watch/admission/close capabilities; recursive
   *   traversal, shared subscriptions and handle lifetime are implemented by
   *   the observer and selected backend.
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
