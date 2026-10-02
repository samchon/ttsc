import type { EntityName } from "./EntityName";
import type { Identifier } from "./Identifier";

/**
 * A dotted entity name used in type space, e.g. `ns.Type`.
 *
 * Built by {@link factory.createQualifiedName}.
 *
 * @evidence contracts/common.md#principled-implementation Recursive EntityName on the left and Identifier on the right represent a dotted entity name without admitting arbitrary expression operands.
 * @evidence contracts/common.md#clear-and-simple-design Two named operands expose the qualification direction while EntityName owns recursion.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Qualification is data composition; this interface introduces no foreign mutation or fallback path.
 * @evidence contracts/common.md#meaningful-documentation JSDoc gives a dotted-name example and labels both operands; member separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface QualifiedName {
  /** Discriminant tag; always `"QualifiedName"`. */
  kind: "QualifiedName";

  /** The left-hand qualifier. */
  left: EntityName;

  /** The right-hand identifier. */
  right: Identifier;
}
