/**
 * A type element placeholder that is intentionally not emitted. It emits
 * nothing, apart from any synthetic comments attached to it.
 *
 * Built by {@link factory.createNotEmittedTypeElement}.
 *
 * @evidence contracts/common.md#principled-implementation The explicit placeholder kind denotes an intentionally empty printed result rather than a missing type member.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only interface carries no unused type payload for suppressed output.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Suppression is the published placeholder contract, not an exception keyed to a consumer or test.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explicitly states empty output and its constructor; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface NotEmittedTypeElement {
  /** Discriminant tag; always `"NotEmittedTypeElement"`. */
  kind: "NotEmittedTypeElement";
}
