import type { Expression } from "./Expression";

/**
 * A comma-separated expression list, e.g. `(a, b, c)`.
 *
 * Built by {@link factory.createCommaListExpression}.
 *
 * The printer joins entries with commas and adds grouping only where the
 * enclosing expression context requires it. Supply a nonempty sequence of
 * valid operands; the array type itself permits an empty sequence.
 *
 * @evidence contracts/common.md#principled-implementation The ordered list represents successive comma operands without nesting binary nodes; nonempty, valid operands are required to represent an expression.
 * @evidence contracts/common.md#clear-and-simple-design One sequence captures the synthetic comma expression; context-dependent parentheses remain with the printer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Entries are real operand nodes rather than joined source snippets used to bypass expression structure.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains grouping ownership and the empty-list limitation, with tags separate from the description under documentation guidance.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export interface CommaListExpression {
  /** Discriminant tag; always `"CommaListExpression"`. */
  kind: "CommaListExpression";

  /** Comma operands in evaluation order; supply at least one. */
  elements: readonly Expression[];
}
