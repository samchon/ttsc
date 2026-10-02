import type { LinuxWatchHelper } from "./LinuxWatchHelper";

/**
 * One shared non-recursive directory watch and its subscribed observers.
 *
 * Readiness belongs to the helper subscription; each observer owns its own
 * event and termination callback until it detaches or the shared watch fails.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Separate observer Sets and one readiness promise distinguish shared native
 *   ownership from each subscriber's callbacks.
 * @evidence contracts/common.md#clear-and-simple-design
 *   The entry contains exactly the shared subscription and its observer lists;
 *   recursive discovery remains with openLinuxDirectoryObserver.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Native readiness is explicit; construction alone cannot certify a watch
 *   live or a directory's contents unchanged.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native type and separated member comments explain readiness, observers and
 *   release ownership under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral consumers receive backend-independent events; this type confines
 *   Linux helper subscription state to the native boundary.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   LinuxDirectoryWatch only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   LinuxDirectoryWatch only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   LinuxDirectoryWatch only declares a shape; it has no handle or retained
 *   state at runtime.
 */
export interface LinuxDirectoryWatch {
  /**
   * Retire the shared helper subscription after the last subscriber leaves or
   * the native watch fails. Failure is then reported to all attached observers.
   *
   * @evidence contracts/common.md#principled-implementation
   *   This operation retires the shared native subscription, not one observer.
   * @evidence contracts/common.md#clear-and-simple-design
   *   A parameterless closer hides helper identifiers from subscribers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   One subscriber cannot retire a healthy watch another still owns; native
   *   failure retires shared authority and notifies every remaining observer.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc distinguishes last-subscriber release from shared failure
   *   retirement under the documentation skill.
   * @evidence contracts/portability.md#os-neutral-implementation
   *   OS-neutral callers release through the closer without platform signals or
   *   assumptions about native descriptor layout.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of close is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of close is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of close is declared here; the cost belongs to its
   *   implementation.
   */
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
