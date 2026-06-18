import type { BinaryExpression, Expression } from "../../ast";
import { SyntaxKind } from "../../syntax";
import { createBinaryExpression } from "./createBinaryExpression";

/**
 * Create a {@link BinaryExpression} with the `<` operator: less-than comparison.
 *
 * Shorthand for {@link createBinaryExpression} with the `LessThanToken`
 * operator. The printer surrounds the operator with a single space on each
 * side.
 *
 * Given operands `a` and `b`, the printer emits:
 *
 * ```ts
 * a < b;
 * ```
 *
 * @author Jeongho Nam - https://github.com/samchon
 * @param left The left-hand operand.
 * @param right The right-hand operand.
 * @returns The created {@link BinaryExpression}.
 */
export const createLessThan = (
  left: Expression,
  right: Expression,
): BinaryExpression =>
  createBinaryExpression(left, SyntaxKind.LessThanToken, right);
