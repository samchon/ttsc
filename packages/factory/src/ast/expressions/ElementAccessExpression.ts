import type { Expression } from "./Expression";

/**
 * An element access, e.g. `object[key]`.
 *
 * Built by {@link factory.createElementAccessExpression}.
 *
 * This ordinary access keeps the receiver and dynamic index as unevaluated
 * syntax. Use a chain node when the link continues optional chaining.
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @evidence contracts/common.md#principled-implementation Receiver and index expressions retain the two roles of indexed access; the ordinary kind distinguishes its boundary from an optional-chain continuation.
 * @evidence contracts/common.md#clear-and-simple-design Two direct operands represent the access without a second cached key or property lookup abstraction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The declaration retains the actual index expression instead of guessing a fixed member from a known receiver.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains ordinary versus chain access and unevaluated operands; separate member comments and acknowledgment tags follow documentation guidance.
 */
export interface ElementAccessExpression {
  /** Discriminant tag; always `"ElementAccessExpression"`. */
  kind: "ElementAccessExpression";

  /** The expression. */
  expression: Expression;

  /** The index or key expression. */
  argumentExpression: Expression;
}
