import type { TypeNode } from "./TypeNode";

/**
 * An optional tuple element type, e.g. `T?`.
 *
 * Built by {@link factory.createOptionalTypeNode}.
 *
 * @evidence contracts/common.md#principled-implementation The wrapper distinguishes postfix tuple optionality from its child type; legal tuple placement is not encoded in the child union.
 * @evidence contracts/common.md#clear-and-simple-design One child owns the operand syntax while the wrapper owns the optional marker.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The optional marker is a syntax distinction rather than a test-selected nullable type.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies tuple use and labels the operand before ?; member separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface OptionalTypeNode {
  /** Discriminant tag; always `"OptionalTypeNode"`. */
  kind: "OptionalTypeNode";

  /** Tuple element type before the optional marker. */
  type: TypeNode;
}
