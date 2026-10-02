import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A type assertion, e.g. `value as T`.
 *
 * Built by {@link factory.createAsExpression}.
 *
 * This records assertion syntax without checking assignability or performing
 * a runtime conversion.
 *
 * @evidence contracts/common.md#principled-implementation Separate expression and TypeNode fields represent the operand and asserted type; the node asserts syntax, not the truth of the type claim.
 * @evidence contracts/common.md#clear-and-simple-design The outline has only the two assertion constituents and its discriminant; parentheses remain a printer responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The asserted type is supplied explicitly rather than changing an operand or substituting a runtime conversion.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes assertion syntax from type checking and conversion; separate member comments and a blank before tags follow documentation guidance.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface AsExpression {
  /** Discriminant tag; always `"AsExpression"`. */
  kind: "AsExpression";

  /** The expression. */
  expression: Expression;

  /** The type. */
  type: TypeNode;
}
