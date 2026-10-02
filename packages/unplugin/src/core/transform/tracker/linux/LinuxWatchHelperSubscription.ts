/**
 * What the Linux watch helper tells one directory subscription
 * (samchon/ttsc#1426).
 *
 * @evidence contracts/common.md#principled-implementation
 *   Readiness, named or unnamed events and termination are distinct protocol
 *   transitions; null names retain uncertainty after dropped notifications.
 * @evidence contracts/common.md#clear-and-simple-design
 *   Three callbacks describe one subscription without exposing pipe buffers,
 *   process reference counts or protocol identifiers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   A missing event name does not become an invented filename; termination
 *   cannot masquerade as a live subscription's quiet interval.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native type and separated callback paragraphs explain protocol meaning,
 *   following the documentation skill.
 */
export interface LinuxWatchHelperSubscription {
  /**
   * The helper answered the subscription: `true` once the watch is live, and
   * `false` when the directory could not be watched.
   *
   * @evidence contracts/common.md#principled-implementation
   *   A boolean acknowledgment distinguishes a live watch from refused coverage.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One result callback reports opening without exposing child protocol state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Readiness requires the helper's answer, not successful request submission.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc defines both boolean outcomes under the documentation skill.
   */
  ready(live: boolean): void;

  /**
   * One event of the directory, or `null` for the name when events were
   * dropped, which may concern anything the subscription covers.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Nullable names represent lost attribution while retaining event type.
   * @evidence contracts/common.md#clear-and-simple-design
   *   One callback forwards observation; scope interpretation remains with owners.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   Unnamed events preserve uncertainty instead of being silently discarded.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc explains dropped-name breadth under the documentation skill.
   */
  event(eventType: string, filename: string | null): void;

  /**
   * The subscription ended without being removed: the directory went away, or
   * the helper did. Nothing more is reported for it.
   *
   * @evidence contracts/common.md#principled-implementation
   *   Unexpected termination permanently ends this subscription's authority.
   * @evidence contracts/common.md#clear-and-simple-design
   *   A parameterless callback reports termination without duplicating process state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts
   *   A dead helper cannot leave subscription silence certified as live coverage.
   * @evidence contracts/common.md#meaningful-documentation
   *   Native JSDoc identifies terminal causes and the no-further-events condition
   *   under the documentation skill.
   */
  end(): void;
}
