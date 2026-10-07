import type { TypeNode } from "./TypeNode";

/**
 * An optional tuple element type, e.g. `T?`.
 *
 * Built by {@link factory.createOptionalTypeNode}.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation The wrapper distinguishes postfix tuple optionality from its child type; legal tuple placement is not encoded in the child union.
 * @evidence contracts/common.md#clear-and-simple-design One child owns the operand syntax while the wrapper owns the optional marker.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The optional marker is a syntax distinction rather than a test-selected nullable type.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies tuple use and labels the operand before ?; member separation follows the documentation skill.
 */
export interface OptionalTypeNode {
  /** Discriminant tag; always `"OptionalTypeNode"`. */
  kind: "OptionalTypeNode";

  /** Tuple element type before the optional marker. */
  type: TypeNode;
}
