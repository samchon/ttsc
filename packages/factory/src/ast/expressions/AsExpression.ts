import type { TypeNode } from "../types/TypeNode";
import type { Expression } from "./Expression";

/**
 * A type assertion, e.g. `value as T`.
 *
 * Built by {@link factory.createAsExpression}.
 *
 * This records assertion syntax without checking assignability or performing a
 * runtime conversion.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Separate expression and TypeNode fields represent the operand and asserted type; the node asserts syntax, not the truth of the type claim.
 * @evidence contracts/common.md#clear-and-simple-design The outline has only the two assertion constituents and its discriminant; parentheses remain a printer responsibility.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The asserted type is supplied explicitly rather than changing an operand or substituting a runtime conversion.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes assertion syntax from type checking and conversion; separate member comments and a blank before tags follow documentation guidance.
 */
export interface AsExpression {
  /** Discriminant tag; always `"AsExpression"`. */
  kind: "AsExpression";

  /** The expression. */
  expression: Expression;

  /** The type. */
  type: TypeNode;
}
