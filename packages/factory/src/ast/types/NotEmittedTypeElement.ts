/**
 * A type element placeholder that is intentionally not emitted. It emits
 * nothing, apart from any synthetic comments attached to it.
 *
 * Built by {@link factory.createNotEmittedTypeElement}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The explicit placeholder kind denotes an intentionally empty printed result rather than a missing type member.
 * @evidence contracts/common.md#clear-and-simple-design A kind-only interface carries no unused type payload for suppressed output.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Suppression is the published placeholder contract, not an exception keyed to a consumer or test.
 * @evidence contracts/common.md#meaningful-documentation JSDoc explicitly states empty output and its constructor; prose/tag separation follows the documentation skill.
 */
export interface NotEmittedTypeElement {
  /** Discriminant tag; always `"NotEmittedTypeElement"`. */
  kind: "NotEmittedTypeElement";
}
