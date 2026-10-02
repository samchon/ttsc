import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";

/**
 * The adapter's own observer of compiler inputs, keyed by owner
 * (`createInputObserver`).
 *
 * @evidence contracts/common.md#principled-implementation Owner registrations and pre-compile sequence tokens preserve which recorded conditions authorize each consumer's delivery.
 * @evidence contracts/common.md#clear-and-simple-design Root, registration, and lifetime boundaries stay independent of consumer-specific reload and record-signaling APIs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Owners register actual delivery dependencies; observation cannot manufacture compiler proof or host success.
 * @evidence contracts/common.md#meaningful-documentation Method comments distinguish sequence capture, failed-delivery retention, and reusable lifetime after disposal.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation
 *   InputObserver only declares a shape; it has no filesystem, path or
 *   process operation at runtime.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   InputObserver only declares a shape; it has no computation at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   InputObserver only declares a shape; it has no work to reuse at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   InputObserver only declares a shape; it has no handle or retained state
 *   at runtime.
 */
export interface InputObserver {
  /**
   * The current change sequence, taken before a compile so a registration can
   * tell what changed during it.
   *
   * @evidence contracts/common.md#principled-implementation The token orders a compile against events and newly established scopes, letting replacement identify its observation window.
   * @evidence contracts/common.md#clear-and-simple-design One number communicates ordering without copying observer history to every consumer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Capturing a token does not certify unchanged inputs; replacement still checks actual history.
   * @evidence contracts/common.md#meaningful-documentation The comment explains pre-compile capture and its later registration purpose.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of begin is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of begin is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of begin is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of begin is declared here; the cost belongs to its
   *   implementation.
   */
  begin(): number;

  /**
   * Close every scope, poller, and timer, and forget every owner. The observer
   * stays open on its root, and observes owners again as they register.
   *
   * @evidence contracts/common.md#principled-implementation Disposal ends current registrations and their resources while allowing later deliveries to register again on the root.
   * @evidence contracts/common.md#clear-and-simple-design One lifecycle boundary releases observer-owned state rather than exposing every native watch to consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Disposal removes observation authority instead of transferring stale proof to new registrations.
   * @evidence contracts/common.md#meaningful-documentation The prose distinguishes releasing current owners from permanently closing the observer.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of dispose is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of dispose is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of dispose is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of dispose is declared here; the cost belongs to its
   *   implementation.
   */
  dispose(): Promise<void>;

  /**
   * Release every input one owner registered.
   *
   * @evidence contracts/common.md#principled-implementation Removing one owner preserves conditions still owned by others and releases inputs whose final registration leaves.
   * @evidence contracts/common.md#clear-and-simple-design Owner identity selects the existing registration set without exposing shared-entry reference counts.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Owner removal cannot clear another owner's valid registration or alter its host methods.
   * @evidence contracts/common.md#meaningful-documentation The comment identifies the owner as the unit of removal rather than a file or the whole observer.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of forget is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of forget is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of forget is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of forget is declared here; the cost belongs to its
   *   implementation.
   */
  forget(owner: string): void;

  /**
   * Anchor the observer at a root, which a pinned scope then observes, unless
   * the host declared polling, which sends every input to the bounded poll
   * instead (samchon/ttsc#1395). Called again, it re-anchors. Nothing is
   * observed before the first call.
   *
   * @evidence contracts/common.md#principled-implementation Opening establishes the project-root boundary and declares whether native notifications or polling can observe subsequent registrations.
   * @evidence contracts/common.md#clear-and-simple-design Root anchoring and watch policy share one operation before registration begins.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A polling declaration prevents native silence from being treated as freshness authority.
   * @evidence contracts/common.md#meaningful-documentation The comment explains root anchoring, polling, and the unobserved state before first open.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of open is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of open is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of open is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of open is declared here; the cost belongs to its
   *   implementation.
   */
  open(root: string, polling: boolean): void;

  /**
   * Replace one owner's inputs with a delivery's, keeping a failed delivery's
   * previous spellings for recovery. Each input is proven against the disk now,
   * or, given `startedAt`, only against changes since that sequence
   * (samchon/ttsc#1423).
   *
   * @evidence contracts/common.md#principled-implementation Replacement registers recorded conditions and checks the compile-to-subscribe window; failed delivery retains previous spellings that its exception may omit.
   * @evidence contracts/common.md#clear-and-simple-design One operation updates the owner's conditions instead of exposing separate add/remove steps that could lose shared ownership.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A token narrows proof only through actual history, and failure cannot erase prior recovery dependencies.
   * @evidence contracts/common.md#meaningful-documentation The prose explains failed-delivery retention and why an optional pre-compile token affects validation.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation
   *   Only the signature of replace is declared here; the platform behaviour
   *   belongs to its implementation.
   * @evidenceExclude contracts/performance.md#efficient-algorithms
   *   Only the signature of replace is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work
   *   Only the signature of replace is declared here; the cost belongs to its
   *   implementation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
   *   Only the signature of replace is declared here; the cost belongs to its
   *   implementation.
   */
  replace(
    owner: string,
    inputs: readonly TtscWatchInput[],
    failed?: boolean,
    startedAt?: number,
  ): void;
}
