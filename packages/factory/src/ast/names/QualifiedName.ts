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
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
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
