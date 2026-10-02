import type { Identifier } from "../names/Identifier";
import type { PrivateIdentifier } from "../names/PrivateIdentifier";
import type { Expression } from "./Expression";

/**
 * A property access, e.g. `object.member`.
 *
 * Built by {@link factory.createPropertyAccessExpression}.
 *
 * This is an ordinary dotted access. Use a chain node for an optional-chain
 * continuation. The outline does not resolve members or validate private-name
 * access in its enclosing class context.
 *
 * @evidence contracts/common.md#principled-implementation Receiver and identifier represent ordinary dotted syntax, distinct from a chain continuation; identifier typing does not establish member resolution or private-name legality.
 * @evidence contracts/common.md#clear-and-simple-design Two constituents expose the access without cached lookup state or a duplicated receiver representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The explicit member name is not selected from known consumer objects or implemented by mutating their properties.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains chain boundaries and member-resolution limits; separately documented operands and tags follow the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface PropertyAccessExpression {
  /** Discriminant tag; always `"PropertyAccessExpression"`. */
  kind: "PropertyAccessExpression";

  /** The expression. */
  expression: Expression;

  /** The name. */
  name: Identifier | PrivateIdentifier;
}
