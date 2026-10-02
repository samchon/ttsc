import type { WatchBrokerSink } from "./WatchBrokerSink";

/**
 * One live registration of the isolated watch process: its watches' sink, and
 * what routing a message to it needs.
 *
 * @evidence contracts/common.md#principled-implementation
 *   Required canonical-to-owner spellings preserve alias identity for events;
 *   drain participation is distinct from readiness and event forwarding.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One registration combines sink, translation and opening resolver without
 *   duplicating the broker's process or outstanding drain maps.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Mandatory translation prevents silently falling back to foreign path
 *   spellings when registering an alias-aware consumer.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native type and separated member comments explain routing authority and
 *   required translation under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   OS-neutral routing maps native canonical paths back to each owner's
 *   spelling instead of lowercasing or assuming textual aliases are equal.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   WatchBrokerRegistration only declares a shape; it has no computation at
 *   runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   WatchBrokerRegistration only declares a shape; it has no work to reuse at
 *   runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   WatchBrokerRegistration only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export interface WatchBrokerRegistration {
  /**
   * Whether the registration takes part in drains, and so hears each drain's
   * verdict on its watches (`WatchBrokerSink.unproven`). A watch that only
   * forwards events, such as an input observer's scope, does not.
   */
  drains: boolean;

  /**
   * Resolve the registration's wait for its watches to open.
   *
   * Failure is reported separately through the sink before this opening wait
   * ends.
   */
  ready: WatchBrokerOpeningComplete;

  /** Where the registration's messages go. */
  sink: WatchBrokerSink;

  /**
   * The registration's own spelling for each canonical directory the child
   * watches, so a reported event is translated back before anything compares it
   * with a path the registration produced.
   *
   * Required, not optional. A registration that forgot it would fall back to
   * the child's canonical spelling and silently reintroduce the mismatch this
   * map exists to remove, with no type error and no failing test.
   */
  spellings: ReadonlyMap<string, string>;
}

/**
 * End a registration's opening wait after any failure has reached its sink.
 *
 * Completion alone cannot certify watch success; the sink owns that verdict.
 *
 * @evidence contracts/common.md#principled-implementation Resolution ends the wait independently of the sink's success or failure authority.
 * @evidence contracts/common.md#clear-and-simple-design A parameterless callback preserves function-property variance and complements the separate failure channel.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Completion cannot erase failure or fabricate notification coverage.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish completion and success under the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral opening waits finish through explicit backend acknowledgment rather than a platform startup timing assumption.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   WatchBrokerOpeningComplete only declares a shape; it has no computation
 *   at runtime.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   WatchBrokerOpeningComplete only declares a shape; it has no work to reuse
 *   at runtime.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   WatchBrokerOpeningComplete only declares a shape; it has no handle or
 *   retained state at runtime.
 */
export type WatchBrokerOpeningComplete = () => void;
